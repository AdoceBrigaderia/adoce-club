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
import android.util.Log;
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
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
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
    public static final String ACTION_PRINT_ORDER = "adoce.PRINT_ORDER";
    public static final String EXTRA_ORDER_JSON = "order_json";
    private static final String PREFS = "adoce_native_operation";
    private static final String PENDING_ORDER_PREFIX = "pending_order_";
    private static final String CHANNEL = "adoce_orders";
    private static final int NOTIFICATION_ID = 2106;
    private static final String TAG = "AdocePrinter";
    // O gateway do Realtime ainda exige o formato antigo de chave anon (JWT)
    // no parametro "apikey" da URL do websocket -- a "publishable key" nova
    // (sb_publishable_...) que o app manda em start() funciona certinho pra
    // REST/GoTrue (por header), mas o handshake do Realtime responde 401
    // Unauthorized se receber ela ali. Confirmado direto no log de producao:
    // "onFailure: HTTP 401 / Expected HTTP 101 response but was '401
    // Unauthorized'". Chave anon e publica por natureza (o proprio app web a
    // embute no bundle), sem risco em hardcodar aqui.
    private static final String REALTIME_ANON_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlZnd5d2l6cWhmdnZpamFvcGNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMTY5NTksImV4cCI6MjA5OTc5Mjk1OX0.YdfaTjgpBp-nStsmHY-I12it2ecwNIxm8rQbOAKGP5I";
    private static final String DEVICE_KEY = "tablet-operacao-adoce-01";
    private static final UUID PRINTER_SERVICE = UUID.fromString("000018f0-0000-1000-8000-00805f9b34fb");
    private static final UUID PRINTER_WRITE = UUID.fromString("00002af1-0000-1000-8000-00805f9b34fb");
    private final OkHttpClient http = new OkHttpClient.Builder().retryOnConnectionFailure(true).build();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService printerExecutor = Executors.newSingleThreadExecutor();
    private final Set<String> printingIds = ConcurrentHashMap.newKeySet();
    private SharedPreferences prefs;
    private WebSocket socket;
    // Duas chamadas de start() quase simultaneas podiam matar o socket bem
    // no meio do handshake com .close() -- o OkHttp so aciona
    // onOpen/onFailure/onClosed para um socket que chegou a abrir; fechar
    // antes disso e um cancelamento mudo, sem callback nenhum, e o guard
    // socket != null trava connectRealtime() para sempre. Este numero de
    // geracao identifica cada tentativa: se depois do prazo o socket ainda
    // for o mesmo desta tentativa e ela nunca abriu, o watchdog descarta e
    // tenta de novo, sem depender de nenhum callback do OkHttp.
    private int socketGeneration;
    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic writer;
    private int writerWriteType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE;
    private volatile CountDownLatch characteristicWriteLatch;
    private boolean testPending;
    private boolean discoveringPrinter;
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
        if (ACTION_START.equals(action) && socket != null) {
            socket.close(1000, "sessao atualizada");
            socket = null;
        }
        if (ACTION_DISCOVER.equals(action)) discoverPrinter();
        else if (ACTION_TEST.equals(action)) printTest();
        else if (ACTION_PRINT_ORDER.equals(action)) printOrderExtra(intent);
        connectRealtime();
        ensurePrinter();
        return START_STICKY;
    }

    private void printOrderExtra(Intent intent) {
        String json = intent == null ? "" : intent.getStringExtra(EXTRA_ORDER_JSON);
        if (json == null || json.isEmpty()) { setState("pedido de impressão inválido"); return; }
        try {
            JSONObject order = new JSONObject(json);
            String id = order.optString("id");
            if (id.isEmpty()) id = "manual-" + System.currentTimeMillis();
            printOrder(id, order);
        }
        catch (Exception error) { setState("pedido de impressão inválido"); Log.e(TAG, "Pedido para reimpressão inválido", error); }
    }

    private void printTest() {
        if (writer == null) {
            testPending = true;
            ensurePrinter();
            return;
        }
        printerExecutor.execute(() -> {
            try {
                writeReceipt(testReceipt());
                setState("teste impresso");
                Log.i(TAG, "Ficha de teste enviada com sucesso");
            } catch (Exception error) {
                writer = null;
                setState("falha ao imprimir teste");
                Log.e(TAG, "Falha ao imprimir ficha de teste", error);
            }
        });
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
        if (base.isEmpty() || key.isEmpty() || access.isEmpty()) { setState("sem sessao"); Log.e(TAG, "Realtime sem sessao (url=" + base.length() + ", key=" + key.length() + ", access=" + access.length() + ")"); return; }
        Log.i(TAG, "Abrindo Realtime (url=" + base.length() + ", key=" + key.length() + ", access=" + access.length() + ")");
        String ws = base.replaceFirst("^https", "wss") + "/realtime/v1/websocket?apikey=" + REALTIME_ANON_KEY + "&vsn=1.0.0";
        // Supabase Realtime authenticates this websocket with the apikey query
        // parameter and the access_token in the join payload below. Sending a
        // second Authorization header makes the gateway reject the upgrade.
        Request request = new Request.Builder().url(ws).build();
        int myGeneration = ++socketGeneration;
        boolean[] opened = { false };
        socket = http.newWebSocket(request, new WebSocketListener() {
            @Override public void onOpen(WebSocket webSocket, Response response) {
                opened[0] = true;
                try {
                    JSONObject changes = new JSONObject().put("event", "INSERT").put("schema", "public").put("table", "instant_orders");
                    // Portal de operacao (num navegador qualquer, sem Bluetooth) grava
                    // aqui pra mandar o tablet imprimir/reimprimir a distancia.
                    JSONObject printCommandChanges = new JSONObject().put("event", "INSERT").put("schema", "public").put("table", "operation_print_commands");
                    JSONObject config = new JSONObject()
                        .put("broadcast", new JSONObject().put("ack", false).put("self", false))
                        .put("presence", new JSONObject().put("key", ""))
                        .put("postgres_changes", new JSONArray().put(changes).put(printCommandChanges));
                    JSONObject payload = new JSONObject().put("config", config).put("access_token", prefs.getString("access", ""));
                    webSocket.send(new JSONObject().put("topic", "realtime:public:instant_orders")
                        .put("event", "phx_join").put("payload", payload).put("ref", "1").put("join_ref", "1").toString());
                    Log.i(TAG, "Realtime socket aberto; join enviado");
                    setState("ouvindo pedidos");
                    sendHeartbeat();
                    scheduleHeartbeat();
                } catch (Exception e) { reconnect("falha no canal"); }
            }
            @Override public void onMessage(WebSocket webSocket, String text) {
                try {
                    JSONObject message = new JSONObject(text);
                    if ("phx_reply".equals(message.optString("event"))) {
                        JSONObject payload = message.optJSONObject("payload");
                        if (payload != null && "ok".equals(payload.optString("status"))) {
                            Log.i(TAG, "Canal Realtime confirmado");
                        } else if (payload != null) {
                            setState("sessao realtime rejeitada");
                            Log.e(TAG, "Realtime rejeitou a sessao: " + payload.optJSONObject("response"));
                        }
                        return;
                    }
                    if (!"postgres_changes".equals(message.optString("event"))) return;
                    JSONObject data = message.optJSONObject("payload").optJSONObject("data");
                    if (data == null) return;
                    if ("operation_print_commands".equals(data.optString("table"))) {
                        JSONArray requestedIds = resolveOrderIds(data.optJSONObject("record"));
                        if (requestedIds != null && requestedIds.length() > 0) {
                            Log.i(TAG, "Comando de reimpressao recebido: " + requestedIds.length() + " pedido(s)");
                            printSpecificOrders(requestedIds);
                        } else {
                            Log.i(TAG, "Comando de impressao de pendentes recebido");
                            printPendingOrders();
                        }
                        return;
                    }
                    JSONObject record = data.optJSONObject("record");
                    if (record != null) {
                        Log.i(TAG, "INSERT instant_orders recebido: " + record.optString("id"));
                        fetchOrder(record.optString("id"));
                    }
                } catch (Exception ignored) { }
            }
            @Override public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                Log.e(TAG, "Falha Realtime HTTP " + (response == null ? "sem resposta" : response.code()), t);
                reconnect("reconectando");
            }
            @Override public void onClosed(WebSocket webSocket, int code, String reason) {
                Log.w(TAG, "Realtime fechado " + code + ": " + reason);
                reconnect("reconectando");
            }
        });
        // Watchdog: se em 10s esta tentativa nao abriu nem falhou (o
        // cancelamento de um socket ainda em handshake as vezes nao aciona
        // nenhum callback do OkHttp), descarta a referencia morta e tenta de
        // novo. Sem isto um socket "morto no meio do caminho" trava
        // connectRealtime() para sempre (o guard so olha socket != null).
        handler.postDelayed(() -> {
            if (socketGeneration != myGeneration || opened[0]) return;
            Log.w(TAG, "Realtime nao abriu em 10s, descartando e tentando de novo");
            if (socket != null) socket.cancel();
            socket = null;
            connectRealtime();
        }, 10_000);
    }

    private void scheduleHeartbeat() {
        handler.postDelayed(() -> {
            if (socket == null) return;
            sendHeartbeat();
            try {
                socket.send(new JSONObject().put("topic", "phoenix").put("event", "heartbeat")
                    .put("payload", new JSONObject()).put("ref", String.valueOf(System.currentTimeMillis())).toString());
            } catch (Exception ignored) { }
            if (tokenExpiresSoon()) refreshSession(() -> reconnect("renovando sessao"));
            else scheduleHeartbeat();
        }, 25_000);
    }

    private void sendHeartbeat() {
        String base = prefs.getString("url", "");
        String key = prefs.getString("key", "");
        String access = prefs.getString("access", "");
        if (base.isEmpty() || key.isEmpty() || access.isEmpty()) return;
        try {
            JSONObject body = new JSONObject()
                .put("p_device_key", DEVICE_KEY)
                .put("p_device_label", "Tablet VAIO TL10")
                .put("p_service_state", state)
                .put("p_printer_online", writer != null)
                .put("p_pending_count", pendingIds(prefs).size());
            Request request = new Request.Builder()
                .url(base + "/rest/v1/rpc/staff_upsert_operation_device_status")
                .post(RequestBody.create(body.toString(), MediaType.get("application/json")))
                .header("apikey", key)
                .header("Authorization", "Bearer " + access)
                .header("Content-Type", "application/json")
                .build();
            http.newCall(request).enqueue(new Callback() {
                @Override public void onFailure(Call call, java.io.IOException e) { }
                @Override public void onResponse(Call call, Response response) throws java.io.IOException { response.close(); }
            });
        } catch (Exception ignored) { }
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

    private void fetchOrder(String id) { fetchOrder(id, false); }

    // force=true reimprime mesmo que o tablet ja tenha marcado esta comanda
    // como impressa antes -- caso do "Reimprimir selecionados" do portal de
    // operacao, que reimprime comandas ja finalizadas. Sem forcar,
    // isPrinted(id) faria este pedido de reimpressao ser descartado em
    // silencio (sintoma reportado: "seleciono e nao acontece nada").
    private void fetchOrder(String id, boolean force) {
        if (id == null || id.isEmpty() || (!force && isPrinted(id))) return;
        if (tokenExpiresSoon()) {
            if (!force) queue(id);
            refreshSession(() -> { if (force) fetchOrderNow(id, true); else drainQueue(); });
            return;
        }
        fetchOrderNow(id, force);
    }

    private void fetchOrderNow(String id, boolean force) {
        HttpUrl url = HttpUrl.parse(prefs.getString("url", "") + "/rest/v1/instant_orders").newBuilder()
            .addQueryParameter("id", "eq." + id)
            .addQueryParameter("select", "*,instant_order_items(id,flavor_name,quantity,unit_price,is_reward,instant_order_item_sauces(unit_number,sauce_name))")
            .build();
        Request request = new Request.Builder().url(url)
            .header("apikey", prefs.getString("key", ""))
            .header("Authorization", "Bearer " + prefs.getString("access", ""))
            .header("Accept", "application/json").build();
        http.newCall(request).enqueue(new Callback() {
            @Override public void onFailure(Call call, java.io.IOException e) { if (!force) queue(id); }
            @Override public void onResponse(Call call, Response response) throws java.io.IOException {
                try (response) {
                    if (!response.isSuccessful()) { if (!force) queue(id); return; }
                    JSONArray rows = new JSONArray(response.body().string());
                    if (rows.length() == 0) { if (!force) queue(id); return; }
                    printOrder(id, rows.getJSONObject(0));
                } catch (Exception e) { if (!force) queue(id); }
            }
        });
    }

    // O realtime do Supabase normalmente manda coluna uuid[] como array JSON
    // de verdade, mas alguns caminhos mandam a representacao textual do
    // Postgres, tipo {"id1","id2"}. Cobre os dois formatos.
    private JSONArray resolveOrderIds(JSONObject commandRecord) {
        if (commandRecord == null) return null;
        JSONArray asArray = commandRecord.optJSONArray("order_ids");
        if (asArray != null) return asArray;
        String raw = commandRecord.optString("order_ids", "");
        if (raw.isEmpty() || "null".equals(raw)) return null;
        String trimmed = raw.trim();
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) trimmed = trimmed.substring(1, trimmed.length() - 1);
        JSONArray parsed = new JSONArray();
        for (String piece : trimmed.split(",")) {
            String id = piece.trim().replace("\"", "");
            if (!id.isEmpty()) parsed.put(id);
        }
        return parsed.length() > 0 ? parsed : null;
    }

    // Comando especifico do portal de operacao (RemotePrintTrigger /
    // "Reimprimir selecionados"): reimprime exatamente estas comandas, ainda
    // que ja estejam marcadas como impressas.
    private void printSpecificOrders(JSONArray orderIds) {
        if (tokenExpiresSoon()) { refreshSession(() -> printSpecificOrders(orderIds)); return; }
        setState("reimprimindo " + orderIds.length() + " comanda(s) a pedido do portal");
        for (int i = 0; i < orderIds.length(); i++) {
            String id = orderIds.optString(i, "");
            if (!id.isEmpty()) fetchOrder(id, true);
        }
    }

    // Sob demanda (RemotePrintTrigger "Mandar imprimir pendentes"): busca
    // direto no banco todo pedido ainda nao finalizado e reaproveita
    // fetchOrder(), que ja pula o que estiver marcado como impresso.
    private void printPendingOrders() {
        if (tokenExpiresSoon()) { refreshSession(this::fetchPendingOrderIds); return; }
        fetchPendingOrderIds();
    }

    private void fetchPendingOrderIds() {
        HttpUrl url = HttpUrl.parse(prefs.getString("url", "") + "/rest/v1/instant_orders").newBuilder()
            .addQueryParameter("status", "not.in.(completed,cancelled,expired)")
            .addQueryParameter("select", "id")
            .addQueryParameter("order", "created_at.asc")
            .build();
        Request request = new Request.Builder().url(url)
            .header("apikey", prefs.getString("key", ""))
            .header("Authorization", "Bearer " + prefs.getString("access", ""))
            .header("Accept", "application/json").build();
        setState("buscando pedidos pendentes");
        http.newCall(request).enqueue(new Callback() {
            @Override public void onFailure(Call call, java.io.IOException e) { setState("falha ao buscar pedidos pendentes"); }
            @Override public void onResponse(Call call, Response response) throws java.io.IOException {
                try (response) {
                    if (!response.isSuccessful()) { setState("falha ao buscar pedidos pendentes"); return; }
                    JSONArray rows = new JSONArray(response.body().string());
                    setState(rows.length() == 0 ? "nenhum pedido pendente" : "imprimindo " + rows.length() + " pedido(s) pendente(s)");
                    for (int i = 0; i < rows.length(); i++) {
                        String id = rows.getJSONObject(i).optString("id");
                        if (!id.isEmpty()) fetchOrder(id);
                    }
                } catch (Exception e) { setState("falha ao buscar pedidos pendentes"); }
            }
        });
    }

    private void printOrder(String id, JSONObject order) {
        if (id == null || id.isEmpty() || !printingIds.add(id)) {
            if (id != null && !id.isEmpty()) Log.i(TAG, "Impressao duplicada ignorada: " + id);
            return;
        }
        if (writer == null) { queueOrder(id, order); ensurePrinter(); printingIds.remove(id); return; }
        printerExecutor.execute(() -> {
            try {
                writeReceipt(receipt(order));
                markPrinted(id);
                setState("pedido " + order.optString("order_number") + " impresso");
            } catch (Exception e) { queueOrder(id, order); setState("impressora desconectada"); writer = null; }
            finally { printingIds.remove(id); }
        });
    }

    private void discoverPrinter() {
        if (!hasScanPermission()) { setState("autorize o Bluetooth"); return; }
        BluetoothAdapter adapter = ((BluetoothManager)getSystemService(BLUETOOTH_SERVICE)).getAdapter();
        if (adapter == null || !adapter.isEnabled()) { setState("ligue o Bluetooth"); return; }
        setState("procurando impressora");
        discoveringPrinter = true;
        adapter.getBluetoothLeScanner().startScan(scanCallback);
        handler.postDelayed(() -> {
            if (hasScanPermission()) adapter.getBluetoothLeScanner().stopScan(scanCallback);
            if (discoveringPrinter) {
                discoveringPrinter = false;
                if (writer == null) setState("KNUP nao encontrada");
            }
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
                discoveringPrinter = false;
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
            if (writer == null || !canWrite(writer)) writer = findWritableCharacteristic(bluetoothGatt);
            if (writer == null) { setState("protocolo da KNUP nao encontrado"); return; }
            writerWriteType = (writer.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0
                ? BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
                : BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT;
            writer.setWriteType(writerWriteType);
            Log.i(TAG, "Canal de impressao: " + writer.getService().getUuid() + "/" + writer.getUuid());
            setState("impressora pronta");
            if (testPending) { testPending = false; printerExecutor.execute(() -> { try { writeReceipt(testReceipt()); } catch (Exception ignored) {} }); }
            drainQueue();
        }

        @Override public void onCharacteristicWrite(BluetoothGatt bluetoothGatt, BluetoothGattCharacteristic characteristic, int status) {
            CountDownLatch latch = characteristicWriteLatch;
            if (latch != null) latch.countDown();
            if (status != BluetoothGatt.GATT_SUCCESS) Log.e(TAG, "Falha na escrita BLE: " + status);
        }
    };

    private boolean canWrite(BluetoothGattCharacteristic characteristic) {
        int properties = characteristic.getProperties();
        return (properties & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0 ||
            (properties & BluetoothGattCharacteristic.PROPERTY_WRITE) != 0;
    }

    private BluetoothGattCharacteristic findWritableCharacteristic(BluetoothGatt bluetoothGatt) {
        BluetoothGattCharacteristic withResponse = null;
        for (BluetoothGattService candidateService : bluetoothGatt.getServices()) {
            for (BluetoothGattCharacteristic characteristic : candidateService.getCharacteristics()) {
                int properties = characteristic.getProperties();
                Log.d(TAG, "Canal anunciado: " + candidateService.getUuid() + "/" + characteristic.getUuid() + " props=" + properties);
                if ((properties & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0) return characteristic;
                if (withResponse == null && (properties & BluetoothGattCharacteristic.PROPERTY_WRITE) != 0) withResponse = characteristic;
            }
        }
        return withResponse;
    }

    private void writeReceipt(byte[] bytes) throws Exception {
        if (writer == null || gatt == null || !hasConnectPermission()) throw new IllegalStateException("sem impressora");
        int chunks = (bytes.length + 19) / 20;
        Log.i(TAG, "Enviando ficha ESC/POS: " + bytes.length + " bytes em " + chunks + " pacotes");
        for (int start = 0; start < bytes.length; start += 20) {
            int size = Math.min(20, bytes.length - start);
            byte[] chunk = new byte[size]; System.arraycopy(bytes, start, chunk, 0, size);
            int result;
            characteristicWriteLatch = writerWriteType == BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                ? new CountDownLatch(1) : null;
            if (Build.VERSION.SDK_INT >= 33) result = gatt.writeCharacteristic(writer, chunk, writerWriteType);
            else { writer.setValue(chunk); result = gatt.writeCharacteristic(writer) ? 0 : -1; }
            if (result != 0) throw new IllegalStateException("falha Bluetooth " + result);
            CountDownLatch latch = characteristicWriteLatch;
            if (latch != null && !latch.await(2, TimeUnit.SECONDS)) throw new IllegalStateException("tempo esgotado no Bluetooth");
            Thread.sleep(35);
        }
        characteristicWriteLatch = null;
    }

    private byte[] receipt(JSONObject order) throws Exception {
        List<String> lines = new ArrayList<>();
        lines.add(center("ADOCE BRIGADERIA")); lines.add(center("FICHA DE PRODUÇÃO E ENTREGA")); lines.add(dashes());
        lines.add(center("PEDIDO")); lines.add(center(order.optString("order_number", "PEDIDO")));
        lines.add("Recebido " + formatDate(order.optString("created_at"))); lines.add(dashes());
        lines.add("CLIENTE"); wrap(lines, order.optString("customer_name")); lines.add(order.optString("customer_phone"));
        lines.add("RETIRADA");
        String pickup = order.optString("pickup_requested_time");
        String pickupLabel = order.optString("pickup_label", "Adoce");
        if (!pickup.isEmpty()) lines.add(pickupLabel + " - " + pickup.substring(0, Math.min(5, pickup.length())));
        else lines.add("A combinar");
        lines.add("Responsável: Cliente");
        String payment = order.optString("payment_method_label");
        if (!payment.isEmpty()) { lines.add("PAGAMENTO"); lines.add(payment); }
        String notes = order.optString("customer_notes");
        if (!notes.isEmpty()) { lines.add(dashes()); lines.add("OBSERVAÇÕES DO CLIENTE"); wrap(lines, notes); }
        lines.add(dashes()); lines.add(center("ITENS DO PEDIDO"));
        JSONArray items = order.optJSONArray("instant_order_items");
        int quantity = 0; int itemNumber = 0; int totalUnits = 0;
        if (items != null) for (int i = 0; i < items.length(); i++) totalUnits += Math.max(1, items.getJSONObject(i).optInt("quantity", 1));
        if (items != null) for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.getJSONObject(i); int qty = item.optInt("quantity", 1); quantity += qty;
            JSONArray sauces = item.optJSONArray("instant_order_item_sauces");
            for (int unit = 1; unit <= qty; unit++) {
                itemNumber++;
                lines.add("[ ] ITEM " + itemNumber + " DE " + totalUnits + " - 1x");
                lines.add("SABOR: " + item.optString("flavor_name"));
                List<String> selected = new ArrayList<>();
                if (sauces != null) for (int s = 0; s < sauces.length(); s++) if (sauces.getJSONObject(s).optInt("unit_number") == unit) selected.add(sauces.getJSONObject(s).optString("sauce_name"));
                lines.add("CALDA: " + (selected.isEmpty() ? "Sem calda" : String.join(" e ", selected)));
                double unitPrice = item.optDouble("unit_price", 0);
                if (item.optBoolean("is_reward", false) && unitPrice == 0) lines.add("FATIA-PRESENTE DO CLUBE - GRÁTIS");
                else lines.add("VALOR: " + String.format(new Locale("pt", "BR"), "R$ %.2f", unitPrice));
                if (unit < qty || i < items.length() - 1) lines.add("................................");
            }
        }
        lines.add(dashes()); lines.add(center(quantity + (quantity == 1 ? " FATIA" : " FATIAS")));
        lines.add(center("TOTAL  R$ " + String.format(new Locale("pt", "BR"), "%.2f", order.optDouble("total"))));
        lines.add(dashes()); lines.add("CONFERÊNCIA DA ENTREGA"); lines.add("[ ] Sabores       [ ] Caldas"); lines.add("[ ] Embalado      [ ] Identificado"); lines.add("[ ] Pronto        [ ] Entregue");
        lines.add(dashes()); lines.add(center("Preparado com carinho para")); lines.add(center("adoçar o seu dia. Obrigado por")); lines.add(center("escolher a Adoce! <3")); lines.add(""); lines.add(center("Impresso " + formatDate(Instant.now().toString())));
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

    private void queue(String id) {
        if (id == null || id.isEmpty()) return;
        Set<String> ids = pendingIds(prefs); ids.add(id); prefs.edit().putStringSet("pending", ids).apply();
    }
    private void queueOrder(String id, JSONObject order) {
        if (id == null || id.isEmpty()) return;
        Set<String> ids = pendingIds(prefs); ids.add(id);
        prefs.edit().putStringSet("pending", ids).putString(PENDING_ORDER_PREFIX + id, order.toString()).apply();
    }
    private void markPrinted(String id) {
        Set<String> ids = pendingIds(prefs); ids.remove(id);
        prefs.edit().putStringSet("pending", ids).remove(PENDING_ORDER_PREFIX + id).putBoolean("printed_" + id, true).apply();
    }
    private boolean isPrinted(String id) { return prefs.getBoolean("printed_" + id, false); }
    private void drainQueue() {
        if (writer == null) return;
        for (String id : pendingIds(prefs)) {
            String json = prefs.getString(PENDING_ORDER_PREFIX + id, "");
            if (!json.isEmpty()) {
                try { printOrder(id, new JSONObject(json)); }
                catch (Exception error) { Log.e(TAG, "Pedido pendente invalido", error); queue(id); }
            } else fetchOrder(id);
        }
    }
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
