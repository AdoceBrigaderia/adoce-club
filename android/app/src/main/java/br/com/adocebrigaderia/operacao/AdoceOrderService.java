package br.com.adocebrigaderia.operacao;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Base64;
import androidx.annotation.Nullable;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;
import com.getcapacitor.JSObject;
import java.io.ByteArrayOutputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.HttpUrl;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import org.json.JSONArray;
import org.json.JSONObject;

public class AdoceOrderService extends Service {
    public static final String ACTION_START = "adoce.START";
    public static final String ACTION_DISCOVER = "adoce.DISCOVER";
    public static final String ACTION_TEST = "adoce.TEST";
    private static final String PREFS = "adoce_native_operation";
    private static final String CHANNEL = "adoce_orders";
    private static final int NOTIFICATION_ID = 2106;
    private static final UUID PRINTER_SERVICE = UUID.fromString("000018f0-0000-1000-8000-00805f9b34fb");
    private static final UUID PRINTER_WRITE = UUID.fromString("00002af1-0000-1000-8000-00805f9b34fb");
    private final OkHttpClient http = new OkHttpClient.Builder().retryOnConnectionFailure(true).build();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService printerExecutor = Executors.newSingleThreadExecutor();
    private SharedPreferences prefs;
    private WebSocket socket;
    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic writer;
    private boolean testPending;
    private String state = "iniciando";

    public static void saveSession(Context context, String url, String key, String access, String refresh) {
        securePrefs(context).edit()
            .putString("url", url).putString("key", key)
            .putString("access", access).putString("refresh", refresh).apply();
    }

    public static void clearSession(Context context) {
        securePrefs(context).edit()
            .remove("access").remove("refresh").apply();
    }

    public static JSObject status(Context context) {
        SharedPreferences p = securePrefs(context);
        JSObject result = new JSObject();
        result.put("service", p.getString("state", "parado"));
        result.put("printer", p.getString("printer_name", "nao configurada"));
        result.put("pending", pendingIds(p).size());
        return result;
    }

    @Override public void onCreate() {
        super.onCreate();
        prefs = securePrefs(this);
        createChannel();
        startForeground(NOTIFICATION_ID, notification("Conectando aos pedidos..."));
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();
        if (ACTION_DISCOVER.equals(action)) discoverPrinter();
        else if (ACTION_TEST.equals(action)) { testPending = true; ensurePrinter(); }
        connectRealtime();
        ensurePrinter();
        return START_STICKY;
    }

    @Nullable @Override public IBinder onBind(Intent intent) { return null; }

    @Override public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (socket != null) socket.close(1000, "logout");
        if (gatt != null && hasConnectPermission()) { gatt.close(); }
        printerExecutor.shutdownNow();
        super.onDestroy();
    }

    private void connectRealtime() {
        if (socket != null) return;
        if (tokenExpiresSoon()) { refreshSession(this::openSocket); return; }
        openSocket();
    }

    private void openSocket() {
        String base = prefs.getString("url", "");
        String key = prefs.getString("key", "");
        String access = prefs.getString("access", "");
        if (base.isEmpty() || key.isEmpty() || access.isEmpty()) { setState("sem sessao"); return; }
        String ws = base.replaceFirst("^https", "wss") + "/realtime/v1/websocket?apikey=" + key + "&vsn=1.0.0";
        Request request = new Request.Builder().url(ws).header("Authorization", "Bearer " + access).build();
        socket = http.newWebSocket(request, new WebSocketListener() {
            @Override public void onOpen(WebSocket webSocket, Response response) {
                try {
                    JSONObject changes = new JSONObject().put("event", "INSERT").put("schema", "public").put("table", "instant_orders");
                    JSONObject config = new JSONObject()
                        .put("broadcast", new JSONObject().put("ack", false).put("self", false))
                        .put("presence", new JSONObject().put("key", ""))
                        .put("postgres_changes", new JSONArray().put(changes));
                    JSONObject payload = new JSONObject().put("config", config).put("access_token", prefs.getString("access", ""));
                    webSocket.send(new JSONObject().put("topic", "realtime:public:instant_orders")
                        .put("event", "phx_join").put("payload", payload).put("ref", "1").put("join_ref", "1").toString());
                    setState("ouvindo pedidos");
                    scheduleHeartbeat();
                } catch (Exception e) { reconnect("falha no canal"); }
            }
            @Override public void onMessage(WebSocket webSocket, String text) {
                try {
                    JSONObject message = new JSONObject(text);
                    if (!"postgres_changes".equals(message.optString("event"))) return;
                    JSONObject record = message.optJSONObject("payload").optJSONObject("data").optJSONObject("record");
                    if (record != null) fetchOrder(record.optString("id"));
                } catch (Exception ignored) { }
            }
            @Override public void onFailure(WebSocket webSocket, Throwable t, Response response) { reconnect("reconectando"); }
            @Override public void onClosed(WebSocket webSocket, int code, String reason) { reconnect("reconectando"); }
        });
    }

    private void scheduleHeartbeat() {
        handler.postDelayed(() -> {
            if (socket == null) return;
            try {
                socket.send(new JSONObject().put("topic", "phoenix").put("event", "heartbeat")
                    .put("payload", new JSONObject()).put("ref", String.valueOf(System.currentTimeMillis())).toString());
            } catch (Exception ignored) { }
            if (tokenExpiresSoon()) refreshSession(() -> reconnect("renovando sessao"));
            else scheduleHeartbeat();
        }, 25_000);
    }

    private void reconnect(String label) {
        handler.removeCallbacksAndMessages(null);
        socket = null;
        setState(label);
        handler.postDelayed(this::connectRealtime, 4_000);
    }

    private boolean tokenExpiresSoon() {
        try {
            String[] parts = prefs.getString("access", "").split("\\.");
            JSONObject body = new JSONObject(new String(Base64.decode(parts[1], Base64.URL_SAFE | Base64.NO_WRAP), StandardCharsets.UTF_8));
            return body.optLong("exp", 0) < (System.currentTimeMillis() / 1000L) + 120;
        } catch (Exception e) { return true; }
    }

    private void refreshSession(Runnable done) {
        String url = prefs.getString("url", "") + "/auth/v1/token?grant_type=refresh_token";
        String key = prefs.getString("key", "");
        try {
            RequestBody body = RequestBody.create(new JSONObject().put("refresh_token", prefs.getString("refresh", "")).toString(), MediaType.get("application/json"));
            http.newCall(new Request.Builder().url(url).post(body).header("apikey", key).build()).enqueue(new Callback() {
                @Override public void onFailure(Call call, java.io.IOException e) { setState("sessao expirada"); }
                @Override public void onResponse(Call call, Response response) throws java.io.IOException {
                    try (response) {
                        if (!response.isSuccessful()) { setState("sessao expirada"); return; }
                        JSONObject json = new JSONObject(response.body().string());
                        prefs.edit().putString("access", json.getString("access_token"))
                            .putString("refresh", json.optString("refresh_token", prefs.getString("refresh", ""))).apply();
                        done.run();
                    } catch (Exception e) { setState("sessao expirada"); }
                }
            });
        } catch (Exception e) { setState("sessao expirada"); }
    }

    private void fetchOrder(String id) {
        if (id == null || id.isEmpty() || isPrinted(id)) return;
        if (tokenExpiresSoon()) { queue(id); refreshSession(() -> drainQueue()); return; }
        HttpUrl url = HttpUrl.parse(prefs.getString("url", "") + "/rest/v1/instant_orders").newBuilder()
            .addQueryParameter("id", "eq." + id)
            .addQueryParameter("select", "*,instant_order_items(id,flavor_name,quantity,instant_order_item_sauces(unit_number,sauce_name))")
            .build();
        Request request = new Request.Builder().url(url)
            .header("apikey", prefs.getString("key", ""))
            .header("Authorization", "Bearer " + prefs.getString("access", ""))
            .header("Accept", "application/json").build();
        http.newCall(request).enqueue(new Callback() {
            @Override public void onFailure(Call call, java.io.IOException e) { queue(id); }
            @Override public void onResponse(Call call, Response response) throws java.io.IOException {
                try (response) {
                    if (!response.isSuccessful()) { queue(id); return; }
                    JSONArray rows = new JSONArray(response.body().string());
                    if (rows.length() == 0) { queue(id); return; }
                    printOrder(id, rows.getJSONObject(0));
                } catch (Exception e) { queue(id); }
            }
        });
    }

    private void printOrder(String id, JSONObject order) {
        if (writer == null) { queue(id); ensurePrinter(); return; }
        printerExecutor.execute(() -> {
            try {
                writeReceipt(receipt(order));
                markPrinted(id);
                setState("pedido " + order.optString("order_number") + " impresso");
            } catch (Exception e) { queue(id); setState("impressora desconectada"); writer = null; }
        });
    }

    private void discoverPrinter() {
        if (!hasScanPermission()) { setState("autorize o Bluetooth"); return; }
        BluetoothAdapter adapter = ((BluetoothManager)getSystemService(BLUETOOTH_SERVICE)).getAdapter();
        if (adapter == null || !adapter.isEnabled()) { setState("ligue o Bluetooth"); return; }
        setState("procurando impressora");
        adapter.getBluetoothLeScanner().startScan(scanCallback);
        handler.postDelayed(() -> {
            if (hasScanPermission()) adapter.getBluetoothLeScanner().stopScan(scanCallback);
            if (writer == null) setState("KNUP nao encontrada");
        }, 12_000);
    }

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override public void onScanResult(int callbackType, ScanResult result) {
            BluetoothDevice device = result.getDevice();
            String name = hasConnectPermission() ? device.getName() : null;
            boolean serviceFound = result.getScanRecord() != null && result.getScanRecord().getServiceUuids() != null &&
                result.getScanRecord().getServiceUuids().stream().anyMatch(uuid -> PRINTER_SERVICE.equals(uuid.getUuid()));
            String n = name == null ? "" : name.toUpperCase(Locale.ROOT);
            if (serviceFound || n.contains("KP-1025") || n.contains("KNUP")) {
                BluetoothAdapter adapter = ((BluetoothManager)getSystemService(BLUETOOTH_SERVICE)).getAdapter();
                if (hasScanPermission()) adapter.getBluetoothLeScanner().stopScan(this);
                prefs.edit().putString("printer_address", device.getAddress()).putString("printer_name", name == null ? "KNUP KP-1025" : name).apply();
                connectPrinter(device);
            }
        }
    };

    private void ensurePrinter() {
        if (writer != null || !hasConnectPermission()) return;
        String address = prefs.getString("printer_address", "");
        if (address.isEmpty()) return;
        try {
            BluetoothAdapter adapter = ((BluetoothManager)getSystemService(BLUETOOTH_SERVICE)).getAdapter();
            connectPrinter(adapter.getRemoteDevice(address));
        } catch (Exception e) { setState("configure a impressora"); }
    }

    private void connectPrinter(BluetoothDevice device) {
        if (!hasConnectPermission()) return;
        if (gatt != null) gatt.close();
        gatt = device.connectGatt(this, false, gattCallback, BluetoothDevice.TRANSPORT_LE);
    }

    private final BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
        @Override public void onConnectionStateChange(BluetoothGatt bluetoothGatt, int status, int newState) {
            if (!hasConnectPermission()) return;
            if (newState == android.bluetooth.BluetoothProfile.STATE_CONNECTED) bluetoothGatt.discoverServices();
            else { writer = null; setState("impressora desconectada"); }
        }
        @Override public void onServicesDiscovered(BluetoothGatt bluetoothGatt, int status) {
            BluetoothGattService service = bluetoothGatt.getService(PRINTER_SERVICE);
            writer = service == null ? null : service.getCharacteristic(PRINTER_WRITE);
            if (writer == null) { setState("protocolo da KNUP nao encontrado"); return; }
            writer.setWriteType(BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE);
            setState("impressora pronta");
            if (testPending) { testPending = false; printerExecutor.execute(() -> { try { writeReceipt(testReceipt()); } catch (Exception ignored) {} }); }
            drainQueue();
        }
    };

    private void writeReceipt(byte[] bytes) throws Exception {
        if (writer == null || gatt == null || !hasConnectPermission()) throw new IllegalStateException("sem impressora");
        for (int start = 0; start < bytes.length; start += 180) {
            int size = Math.min(180, bytes.length - start);
            byte[] chunk = new byte[size]; System.arraycopy(bytes, start, chunk, 0, size);
            int result;
            if (Build.VERSION.SDK_INT >= 33) result = gatt.writeCharacteristic(writer, chunk, BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE);
            else { writer.setValue(chunk); result = gatt.writeCharacteristic(writer) ? 0 : -1; }
            if (result != 0) throw new IllegalStateException("falha Bluetooth " + result);
            Thread.sleep(24);
        }
    }

    private byte[] receipt(JSONObject order) throws Exception {
        List<String> lines = new ArrayList<>();
        lines.add(center("ADOCE BRIGADERIA")); lines.add(center("Confeitaria artesanal")); lines.add("");
        lines.add(center(order.optString("order_number", "PEDIDO")));
        lines.add(center("Pedido em " + formatDate(order.optString("created_at")))); lines.add(dashes());
        lines.add("CLIENTE"); wrap(lines, order.optString("customer_name")); lines.add(order.optString("customer_phone")); lines.add(dashes());
        lines.add("PEDIDO"); int quantity = 0;
        JSONArray items = order.optJSONArray("instant_order_items");
        if (items != null) for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.getJSONObject(i); int qty = item.optInt("quantity", 1); quantity += qty;
            JSONArray sauces = item.optJSONArray("instant_order_item_sauces");
            for (int unit = 1; unit <= qty; unit++) {
                lines.add(("1x " + item.optString("flavor_name")).substring(0, Math.min(32, ("1x " + item.optString("flavor_name")).length())));
                List<String> selected = new ArrayList<>();
                if (sauces != null) for (int s = 0; s < sauces.length(); s++) if (sauces.getJSONObject(s).optInt("unit_number") == unit) selected.add(sauces.getJSONObject(s).optString("sauce_name"));
                lines.add("   " + (selected.isEmpty() ? "Sem calda" : String.join(" e ", selected)));
            }
        }
        lines.add(dashes()); lines.add(quantity + (quantity == 1 ? " FATIA" : " FATIAS") + "  R$ " + String.format(new Locale("pt", "BR"), "%.2f", order.optDouble("total")));
        String notes = order.optString("customer_notes"); if (!notes.isEmpty()) { lines.add(dashes()); lines.add("OBSERVACAO"); wrap(lines, notes); }
        String pickup = order.optString("pickup_requested_time"); if (!pickup.isEmpty()) { lines.add(dashes()); lines.add("RETIRADA"); lines.add(order.optString("pickup_label", "Adoce") + " - " + pickup.substring(0, Math.min(5, pickup.length()))); }
        lines.add(dashes()); lines.add(center("Feito pelas maos da Beth")); lines.add(center("Obrigado por adocar")); lines.add(center("seu momento com a gente")); lines.add(""); lines.add(center("impresso " + formatDate(Instant.now().toString())));
        return escPos(lines, order.optString("order_number"));
    }

    private byte[] testReceipt() {
        List<String> lines = List.of(center("ADOCE BRIGADERIA"), "", center("TESTE ANDROID"), dashes(), "VAIO TL10 + KNUP KP-1025", "Acentos: acao, coracao, cafe", "", center("Impressora pronta"));
        return escPos(lines, "TESTE ANDROID");
    }

    private byte[] escPos(List<String> lines, String highlight) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            out.write(new byte[]{0x1b,0x40,0x1b,0x74,0x03});
            Charset charset; try { charset = Charset.forName("IBM860"); } catch (Exception e) { charset = StandardCharsets.US_ASCII; }
            for (String line : lines) {
                if (line.trim().equals(highlight)) out.write(new byte[]{0x1b,0x45,0x01,0x1d,0x21,0x11,0x1b,0x61,0x01});
                out.write(line.getBytes(charset)); out.write(0x0a);
                if (line.trim().equals(highlight)) out.write(new byte[]{0x1d,0x21,0x00,0x1b,0x45,0x00,0x1b,0x61,0x00});
            }
            out.write(new byte[]{0x1b,0x64,0x04,0x1d,0x56,0x42,0x00}); return out.toByteArray();
        } catch (Exception e) { return new byte[0]; }
    }

    private void queue(String id) { Set<String> ids = pendingIds(prefs); ids.add(id); prefs.edit().putStringSet("pending", ids).apply(); }
    private void markPrinted(String id) { Set<String> ids = pendingIds(prefs); ids.remove(id); prefs.edit().putStringSet("pending", ids).putBoolean("printed_" + id, true).apply(); }
    private boolean isPrinted(String id) { return prefs.getBoolean("printed_" + id, false); }
    private void drainQueue() { if (writer != null) for (String id : pendingIds(prefs)) fetchOrder(id); }
    private static Set<String> pendingIds(SharedPreferences p) { return new HashSet<>(p.getStringSet("pending", new HashSet<>())); }
    private static SharedPreferences securePrefs(Context context) {
        try {
            MasterKey key = new MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build();
            return EncryptedSharedPreferences.create(context, PREFS, key,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM);
        } catch (Exception error) {
            throw new IllegalStateException("Nao foi possivel proteger a sessao nativa.", error);
        }
    }
    private boolean hasScanPermission() { return Build.VERSION.SDK_INT < 31 || ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED; }
    private boolean hasConnectPermission() { return Build.VERSION.SDK_INT < 31 || ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED; }
    private static String dashes() { return "--------------------------------"; }
    private static String center(String s) { int n = Math.max(0, (32 - s.length()) / 2); return " ".repeat(n) + s; }
    private static void wrap(List<String> lines, String text) { String rest = text.trim(); while (rest.length() > 32) { int cut = rest.lastIndexOf(' ', 32); if (cut < 1) cut = 32; lines.add(rest.substring(0, cut)); rest = rest.substring(cut).trim(); } if (!rest.isEmpty()) lines.add(rest); }
    private static String formatDate(String value) { try { return DateTimeFormatter.ofPattern("dd/MM/yyyy 'as' HH'h'mm").withZone(ZoneId.of("America/Fortaleza")).format(Instant.parse(value)); } catch (Exception e) { return value; } }

    private void createChannel() {
        NotificationChannel channel = new NotificationChannel(CHANNEL, "Pedidos e impressao", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Mantem a operacao conectada e imprime novos pedidos.");
        getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }
    private Notification notification(String text) { return new NotificationCompat.Builder(this, CHANNEL).setSmallIcon(R.mipmap.ic_launcher).setContentTitle("Operacao Adoce ativa").setContentText(text).setOngoing(true).setOnlyAlertOnce(true).build(); }
    private void setState(String value) { state = value; prefs.edit().putString("state", value).apply(); getSystemService(NotificationManager.class).notify(NOTIFICATION_ID, notification(value)); }
}
