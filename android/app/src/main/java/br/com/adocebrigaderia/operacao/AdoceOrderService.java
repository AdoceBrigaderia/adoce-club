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
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
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
    public static final String ACTION_SAMPLES = "adoce.SAMPLES";
    public static final String ACTION_LARGE_SAMPLE = "adoce.LARGE_SAMPLE";
    public static final String ACTION_PRINT_PENDING = "adoce.PRINT_PENDING";
    private static final String PREFS = "adoce_native_operation";
    private static final String CHANNEL = "adoce_orders";
    private static final int NOTIFICATION_ID = 2106;
    private static final String TAG = "AdocePrinter";
    private static final UUID PRINTER_SERVICE = UUID.fromString("000018f0-0000-1000-8000-00805f9b34fb");
    private static final UUID PRINTER_WRITE = UUID.fromString("00002af1-0000-1000-8000-00805f9b34fb");
    private final OkHttpClient http = new OkHttpClient.Builder().retryOnConnectionFailure(true).build();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService printerExecutor = Executors.newSingleThreadExecutor();
    private SharedPreferences prefs;
    private WebSocket socket;
    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic writer;
    private int writerWriteType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE;
    private boolean testPending;
    private boolean samplesPending;
    private boolean largeSamplePending;
    private boolean discoveringPrinter;
    private String state = "iniciando";
    // O site (autoRefreshToken) e este servico podiam renovar o mesmo
    // refresh_token ao mesmo tempo; o Supabase so aceita um uso por token e
    // derrubava a sessao inteira quando os dois disputavam. Agora só um
    // pedido de renovacao fica em voo por vez, e uma resposta que chega
    // depois de o token ja ter sido substituido (pelo site ou por outra
    // renovacao) e descartada em vez de sobrescrever o token mais novo.
    private volatile boolean refreshInFlight;
    private int writeChunkSize = 20;
    private boolean printerWatchdogScheduled;

    public static void saveSession(Context context, String url, String key, String access, String refresh) {
        securePrefs(context).edit()
            .putString("url", url).putString("key", key)
            .putString("access", access).putString("refresh", refresh).apply();
    }

    public static void clearSession(Context context) {
        securePrefs(context).edit()
            .remove("url").remove("key")
            .remove("access").remove("refresh").apply();
    }

    public static boolean hasSavedSession(Context context) {
        SharedPreferences p = securePrefs(context);
        return !p.getString("access", "").isEmpty()
            && !p.getString("refresh", "").isEmpty();
    }

    public static JSObject savedSession(Context context) {
        SharedPreferences p = securePrefs(context);
        JSObject result = new JSObject();
        result.put("accessToken", p.getString("access", ""));
        result.put("refreshToken", p.getString("refresh", ""));
        return result;
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
        schedulePrinterWatchdog();
    }

    // Antes, a impressora so tentava reconectar quando um pedido novo
    // chegava - se ela ficasse fora de alcance ou sem bateria num momento sem
    // pedidos, continuava desconectada indefinidamente. Agora tenta de novo
    // sozinha em segundo plano enquanto houver um endereco salvo.
    private void schedulePrinterWatchdog() {
        if (printerWatchdogScheduled) return;
        printerWatchdogScheduled = true;
        handler.postDelayed(this::printerWatchdogTick, 45_000);
    }

    private void printerWatchdogTick() {
        ensurePrinter();
        handler.postDelayed(this::printerWatchdogTick, 45_000);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();
        if (ACTION_DISCOVER.equals(action)) discoverPrinter();
        else if (ACTION_TEST.equals(action)) printTest();
        else if (ACTION_SAMPLES.equals(action)) printSamples();
        else if (ACTION_LARGE_SAMPLE.equals(action)) printLargeSample();
        else if (ACTION_PRINT_PENDING.equals(action)) printPendingOrders();
        connectRealtime();
        ensurePrinter();
        return START_STICKY;
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

    private void printSamples() {
        if (writer == null) {
            samplesPending = true;
            ensurePrinter();
            return;
        }
        printerExecutor.execute(() -> {
            long totalStarted = SystemClock.elapsedRealtime();
            try {
                List<JSONObject> samples = sampleOrders();
                for (int index = 0; index < samples.size(); index++) {
                    JSONObject sample = samples.get(index);
                    byte[] bytes = receipt(sample);
                    long started = SystemClock.elapsedRealtime();
                    writeReceipt(bytes);
                    long duration = SystemClock.elapsedRealtime() - started;
                    Log.i(TAG, "Amostra " + (index + 1) + "/3 enviada: " + bytes.length + " bytes em " + duration + " ms");
                    Thread.sleep(600);
                }
                long totalDuration = SystemClock.elapsedRealtime() - totalStarted;
                setState("3 amostras impressas");
                Log.i(TAG, "Tres amostras enviadas em " + totalDuration + " ms");
            } catch (Exception error) {
                writer = null;
                setState("falha nas amostras");
                Log.e(TAG, "Falha ao imprimir amostras", error);
            }
        });
    }

    private void printLargeSample() {
        if (writer == null) {
            largeSamplePending = true;
            ensurePrinter();
            return;
        }
        printerExecutor.execute(() -> {
            try {
                byte[] bytes = receipt(sampleOrders().get(2));
                long started = SystemClock.elapsedRealtime();
                writeReceipt(bytes);
                long duration = SystemClock.elapsedRealtime() - started;
                setState("amostra grande impressa");
                Log.i(TAG, "Amostra grande enviada: " + bytes.length + " bytes em " + duration + " ms");
            } catch (Exception error) {
                writer = null;
                setState("falha na amostra grande");
                Log.e(TAG, "Falha ao imprimir amostra grande", error);
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
        if (base.isEmpty() || key.isEmpty() || access.isEmpty()) { setState("sem sessao"); return; }
        String ws = base.replaceFirst("^https", "wss") + "/realtime/v1/websocket?apikey=" + key + "&vsn=1.0.0";
        Request request = new Request.Builder().url(ws).header("Authorization", "Bearer " + access).build();
        socket = http.newWebSocket(request, new WebSocketListener() {
            @Override public void onOpen(WebSocket webSocket, Response response) {
                try {
                    JSONObject orderChanges = new JSONObject().put("event", "INSERT").put("schema", "public").put("table", "instant_orders");
                    // Portal de operacao (num navegador qualquer, sem Bluetooth) grava
                    // aqui pra mandar o tablet imprimir os pedidos pendentes a distancia.
                    JSONObject printCommandChanges = new JSONObject().put("event", "INSERT").put("schema", "public").put("table", "operation_print_commands");
                    JSONObject config = new JSONObject()
                        .put("broadcast", new JSONObject().put("ack", false).put("self", false))
                        .put("presence", new JSONObject().put("key", ""))
                        .put("postgres_changes", new JSONArray().put(orderChanges).put(printCommandChanges));
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
                    JSONObject data = message.optJSONObject("payload").optJSONObject("data");
                    if (data == null) return;
                    if ("operation_print_commands".equals(data.optString("table"))) {
                        printPendingOrders();
                        return;
                    }
                    JSONObject record = data.optJSONObject("record");
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
        // O site tambem renova este mesmo refresh_token por conta propria. Se
        // uma renovacao ja esta em voo, nao dispara outra: espera terminar e
        // reavalia com o token que sobrar (do site ou desta renovacao).
        if (refreshInFlight) {
            handler.postDelayed(() -> {
                if (tokenExpiresSoon()) refreshSession(done); else done.run();
            }, 800);
            return;
        }
        String tokenUsed = prefs.getString("refresh", "");
        if (tokenUsed.isEmpty()) { setState("sessao expirada"); return; }
        String url = prefs.getString("url", "") + "/auth/v1/token?grant_type=refresh_token";
        String key = prefs.getString("key", "");
        refreshInFlight = true;
        try {
            RequestBody body = RequestBody.create(new JSONObject().put("refresh_token", tokenUsed).toString(), MediaType.get("application/json"));
            http.newCall(new Request.Builder().url(url).post(body).header("apikey", key).build()).enqueue(new Callback() {
                @Override public void onFailure(Call call, java.io.IOException e) {
                    refreshInFlight = false;
                    recoverFromRefreshFailure(tokenUsed, done);
                }
                @Override public void onResponse(Call call, Response response) throws java.io.IOException {
                    try (response) {
                        if (!response.isSuccessful()) {
                            refreshInFlight = false;
                            recoverFromRefreshFailure(tokenUsed, done);
                            return;
                        }
                        JSONObject json = new JSONObject(response.body().string());
                        // So grava se ninguem (o site, via start(), ou outra
                        // renovacao) ja trocou o refresh_token enquanto esta
                        // chamada estava em voo - senao estariamos
                        // sobrescrevendo um token mais novo com um mais velho.
                        if (tokenUsed.equals(prefs.getString("refresh", ""))) {
                            prefs.edit().putString("access", json.getString("access_token"))
                                .putString("refresh", json.optString("refresh_token", tokenUsed)).apply();
                        }
                        refreshInFlight = false;
                        done.run();
                    } catch (Exception e) {
                        refreshInFlight = false;
                        recoverFromRefreshFailure(tokenUsed, done);
                    }
                }
            });
        } catch (Exception e) {
            refreshInFlight = false;
            recoverFromRefreshFailure(tokenUsed, done);
        }
    }

    // Uma renovacao pode falhar (ex.: "refresh_token already used") justamente
    // porque o site venceu a corrida e ja renovou por fora. Nesse caso o token
    // salvo agora e diferente do que usamos - e valido, so nao era o nosso.
    // So declaramos sessao expirada quando o token continua o mesmo de antes
    // da tentativa, ou seja, ninguem renovou por nos.
    private void recoverFromRefreshFailure(String tokenUsedInFailedAttempt, Runnable done) {
        if (!tokenUsedInFailedAttempt.equals(prefs.getString("refresh", ""))) {
            done.run();
        } else {
            setState("sessao expirada");
        }
    }

    // Sob demanda: pedidos que ficaram sem ficha porque chegaram antes do
    // aplicativo estar ouvindo (app fechado, tablet desligado, impressora
    // fora de alcance na hora) nunca entram na fila local — a fila so
    // guarda o que o canal em tempo real viu passar. Aqui busca direto no
    // banco todo pedido ainda nao finalizado e reaproveita fetchOrder(), que
    // ja pula o que estiver marcado como impresso.
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
            @Override public void onFailure(Call call, java.io.IOException e) {
                setState("falha ao buscar pedidos pendentes");
            }
            @Override public void onResponse(Call call, Response response) throws java.io.IOException {
                try (response) {
                    if (!response.isSuccessful()) { setState("falha ao buscar pedidos pendentes"); return; }
                    JSONArray rows = new JSONArray(response.body().string());
                    setState(rows.length() == 0
                        ? "nenhum pedido pendente"
                        : "imprimindo " + rows.length() + " pedido(s) pendente(s)");
                    for (int i = 0; i < rows.length(); i++) {
                        String id = rows.getJSONObject(i).optString("id");
                        if (!id.isEmpty()) fetchOrder(id);
                    }
                } catch (Exception e) {
                    setState("falha ao buscar pedidos pendentes");
                }
            }
        });
    }

    private void fetchOrder(String id) {
        if (id == null || id.isEmpty() || isPrinted(id)) return;
        if (tokenExpiresSoon()) { queue(id); refreshSession(() -> drainQueue()); return; }
        HttpUrl url = HttpUrl.parse(prefs.getString("url", "") + "/rest/v1/instant_orders").newBuilder()
            .addQueryParameter("id", "eq." + id)
            .addQueryParameter("select", "*,instant_order_items(id,flavor_name,quantity,unit_price,is_reward,reward_id,instant_order_item_sauces(unit_number,sauce_name))")
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
            if (newState == android.bluetooth.BluetoothProfile.STATE_CONNECTED) {
                writeChunkSize = 20;
                // MTU padrao BLE (23 bytes, 20 uteis) e o minimo garantido. A
                // KP-1025 e a maioria das impressoras termicas aceitam bem
                // mais - pedimos 185 e so usamos o valor negociado se ele
                // vier maior; senao seguimos com os 20 bytes de sempre.
                bluetoothGatt.requestMtu(185);
                bluetoothGatt.discoverServices();
            } else { writer = null; setState("impressora desconectada"); }
        }
        @Override public void onMtuChanged(BluetoothGatt bluetoothGatt, int mtu, int status) {
            if (status == BluetoothGatt.GATT_SUCCESS && mtu > 23) {
                writeChunkSize = mtu - 3;
                Log.i(TAG, "MTU negociado: " + mtu + " (blocos de " + writeChunkSize + " bytes)");
            }
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
            if (samplesPending) { samplesPending = false; printSamples(); }
            if (largeSamplePending) { largeSamplePending = false; printLargeSample(); }
            drainQueue();
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
        // Antes disto era sempre 20 bytes (MTU BLE padrao). Quando a
        // impressora aceita um MTU maior (negociado em onMtuChanged), usamos
        // blocos maiores - menos escritas, ficha mais rapida. Continua em
        // blocos porque a caracteristica GATT tem um limite por escrita, e
        // enviar tudo de uma vez chega truncado.
        int chunkSize = Math.max(20, writeChunkSize);
        for (int start = 0; start < bytes.length; start += chunkSize) {
            int size = Math.min(chunkSize, bytes.length - start);
            byte[] chunk = new byte[size]; System.arraycopy(bytes, start, chunk, 0, size);
            int result;
            if (Build.VERSION.SDK_INT >= 33) result = gatt.writeCharacteristic(writer, chunk, writerWriteType);
            else { writer.setValue(chunk); result = gatt.writeCharacteristic(writer) ? 0 : -1; }
            if (result != 0) throw new IllegalStateException("falha Bluetooth " + result);
            Thread.sleep(20);
        }
    }

    private byte[] receipt(JSONObject order) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Charset charset = printerCharset();
        out.write(new byte[]{0x1b, 0x40, 0x1b, 0x74, 0x03});
        printerAlign(out, 1);
        printLogo(out);
        printerBold(out, true); printerSize(out, true, true);
        printerLine(out, charset, "ADOCE BRIGADERIA");
        printerSize(out, false, false); printerBold(out, false);
        printerLine(out, charset, "FICHA DE PRODUÇÃO E ENTREGA");
        printerLine(out, charset, dashes());

        printerBold(out, true); printerSize(out, false, true);
        printerLine(out, charset, "PEDIDO");
        printerSize(out, false, false);
        printerWrapped(out, charset, order.optString("order_number", "PEDIDO"));
        printerBold(out, false);
        printerLine(out, charset, "Recebido " + formatDate(order.optString("created_at")));
        printerLine(out, charset, dashes());

        printerAlign(out, 0); printerBold(out, true);
        printerLine(out, charset, "CLIENTE");
        printerSize(out, false, true);
        printerWrapped(out, charset, order.optString("customer_name", "Cliente"));
        printerSize(out, false, false); printerBold(out, false);
        printerLine(out, charset, formatPhone(order.optString("customer_phone")));

        String pickup = order.optString("pickup_requested_time");
        String pickupLabel = order.optString("pickup_label", "Retirada na Adoce");
        String pickupMethod = "driver".equals(order.optString("pickup_method")) ? "Entregador de aplicativo" : "Cliente";
        printerBold(out, true); printerLine(out, charset, "RETIRADA"); printerBold(out, false);
        printerWrapped(out, charset, pickupLabel + (pickup.isEmpty() ? " - horário a confirmar" : " - " + pickup.substring(0, Math.min(5, pickup.length()))));
        printerWrapped(out, charset, "Responsável: " + pickupMethod);

        String payment = order.optString("payment_method_label");
        if (!payment.isEmpty()) {
            printerBold(out, true); printerLine(out, charset, "PAGAMENTO"); printerBold(out, false);
            printerWrapped(out, charset, payment);
        }

        String notes = order.optString("customer_notes");
        if (!notes.isEmpty()) {
            printerLine(out, charset, dashes()); printerBold(out, true);
            printerLine(out, charset, "OBSERVAÇÕES DO CLIENTE"); printerBold(out, false);
            printerWrapped(out, charset, notes);
        }

        JSONArray items = order.optJSONArray("instant_order_items");
        int quantity = 0;
        if (items != null) for (int i = 0; i < items.length(); i++) quantity += items.getJSONObject(i).optInt("quantity", 1);
        printerLine(out, charset, dashes()); printerAlign(out, 1); printerBold(out, true);
        printerLine(out, charset, "ITENS DO PEDIDO - " + quantity + (quantity == 1 ? " FATIA" : " FATIAS"));
        printerBold(out, false); printerAlign(out, 0);

        int itemNumber = 0;
        if (items != null) for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.getJSONObject(i); int qty = item.optInt("quantity", 1);
            JSONArray sauces = item.optJSONArray("instant_order_item_sauces");
            for (int unit = 1; unit <= qty; unit++) {
                itemNumber++;
                List<String> selected = new ArrayList<>();
                if (sauces != null) for (int s = 0; s < sauces.length(); s++) if (sauces.getJSONObject(s).optInt("unit_number") == unit) selected.add(sauces.getJSONObject(s).optString("sauce_name"));
                printerLine(out, charset, "................................");
                printerBold(out, true);
                printerLine(out, charset, "[ ] ITEM " + itemNumber + " DE " + quantity + " - 1x");
                printerWrapped(out, charset, "SABOR: " + item.optString("flavor_name"));
                printerBold(out, false);
                printerWrapped(out, charset, "CALDA: " + (selected.isEmpty() ? "Sem calda" : String.join(" e ", selected)));
                if (item.optBoolean("is_reward")) {
                    printerBold(out, true); printerLine(out, charset, "FATIA-PRESENTE DO CLUBE - GRÁTIS"); printerBold(out, false);
                } else {
                    printerLine(out, charset, "VALOR: " + money(item.optDouble("unit_price")));
                }
            }
        }

        printerLine(out, charset, dashes()); printerAlign(out, 1); printerBold(out, true);
        printerLine(out, charset, quantity + (quantity == 1 ? " FATIA" : " FATIAS"));
        printerSize(out, true, true);
        printerLine(out, charset, "TOTAL " + money(order.optDouble("total")));
        printerSize(out, false, false); printerBold(out, false);

        printerLine(out, charset, dashes()); printerAlign(out, 0); printerBold(out, true);
        printerLine(out, charset, "CONFERÊNCIA DA ENTREGA"); printerBold(out, false);
        printerLine(out, charset, "[ ] Sabores    [ ] Caldas");
        printerLine(out, charset, "[ ] Embalado   [ ] Identificado");
        printerLine(out, charset, "[ ] Pronto     [ ] Entregue");

        printerLine(out, charset, dashes()); printerAlign(out, 1);
        printerLine(out, charset, "Preparado com carinho para");
        printerLine(out, charset, "adoçar o seu dia. Obrigado por");
        printerLine(out, charset, "escolher a Adoce! <3");
        printerLine(out, charset, "");
        printerLine(out, charset, "Impresso " + formatDate(Instant.now().toString()));
        out.write(new byte[]{0x1b, 0x64, 0x05, 0x1d, 0x56, 0x42, 0x00});
        return out.toByteArray();
    }

    private Charset printerCharset() {
        try { return Charset.forName("IBM860"); }
        catch (Exception error) { return StandardCharsets.US_ASCII; }
    }

    private void printerLine(ByteArrayOutputStream out, Charset charset, String value) throws Exception {
        out.write(value.getBytes(charset)); out.write(0x0a);
    }

    private void printerWrapped(ByteArrayOutputStream out, Charset charset, String value) throws Exception {
        List<String> wrapped = new ArrayList<>(); wrap(wrapped, value);
        for (String line : wrapped) printerLine(out, charset, line);
    }

    private void printerAlign(ByteArrayOutputStream out, int alignment) throws Exception { out.write(new byte[]{0x1b, 0x61, (byte)alignment}); }
    private void printerBold(ByteArrayOutputStream out, boolean enabled) throws Exception { out.write(new byte[]{0x1b, 0x45, (byte)(enabled ? 1 : 0)}); }
    private void printerSize(ByteArrayOutputStream out, boolean doubleWidth, boolean doubleHeight) throws Exception {
        out.write(new byte[]{0x1d, 0x21, (byte)((doubleWidth ? 0x10 : 0) | (doubleHeight ? 0x01 : 0))});
    }

    private void printLogo(ByteArrayOutputStream out) {
        try {
            Bitmap source = BitmapFactory.decodeStream(getAssets().open("public/site/logo.webp"));
            if (source == null) return;
            int width = 112;
            int height = Math.max(1, Math.round(source.getHeight() * (width / (float)source.getWidth())));
            Bitmap logo = Bitmap.createScaledBitmap(source, width, height, true);
            int widthBytes = (width + 7) / 8;
            byte[] pixels = new byte[widthBytes * height];
            for (int y = 0; y < height; y++) for (int x = 0; x < width; x++) {
                int color = logo.getPixel(x, y);
                int alpha = Color.alpha(color);
                int luminance = (Color.red(color) * 299 + Color.green(color) * 587 + Color.blue(color) * 114) / 1000;
                if (alpha > 80 && luminance < 205) pixels[y * widthBytes + (x / 8)] |= (byte)(0x80 >> (x % 8));
            }
            out.write(new byte[]{0x1d, 0x76, 0x30, 0x00, (byte)(widthBytes & 0xff), (byte)((widthBytes >> 8) & 0xff), (byte)(height & 0xff), (byte)((height >> 8) & 0xff)});
            out.write(pixels);
            out.write(0x0a);
            if (logo != source) logo.recycle();
            source.recycle();
        } catch (Exception error) {
            Log.w(TAG, "Logo nao impresso", error);
        }
    }

    private String money(double value) { return String.format(new Locale("pt", "BR"), "R$ %.2f", value); }
    private String formatPhone(String value) {
        String digits = value.replaceAll("\\D", "");
        if (digits.startsWith("55")) digits = digits.substring(2);
        if (digits.length() == 11) return String.format("(%s) %s-%s", digits.substring(0, 2), digits.substring(2, 7), digits.substring(7));
        return value;
    }

    private byte[] testReceipt() {
        List<String> lines = List.of(center("ADOCE BRIGADERIA"), "", center("TESTE ANDROID"), dashes(), "VAIO TL10 + KNUP KP-1025", "Acentos: acao, coracao, cafe", "", center("Impressora pronta"));
        return escPos(lines, "TESTE ANDROID");
    }

    private List<JSONObject> sampleOrders() throws Exception {
        String now = Instant.now().toString();
        List<JSONObject> samples = new ArrayList<>();

        samples.add(new JSONObject()
            .put("order_number", "AMOSTRA 1/3 SIMPLES")
            .put("created_at", now)
            .put("customer_name", "Cliente Teste Simples")
            .put("customer_phone", "(85) 90000-0001")
            .put("total", 18.00)
            .put("payment_method_label", "Dinheiro")
            .put("customer_notes", "")
            .put("pickup_requested_time", "")
            .put("instant_order_items", new JSONArray()
                .put(sampleItem("Fatia Brigadeiro", "Sem calda", 18.00, false))));

        samples.add(new JSONObject()
            .put("order_number", "AMOSTRA 2/3 RETIRADA")
            .put("created_at", now)
            .put("customer_name", "Cliente Teste Retirada")
            .put("customer_phone", "(85) 90000-0002")
            .put("total", 54.00)
            .put("payment_method_label", "Pix")
            .put("customer_notes", "Separar guardanapos e identificar a embalagem com o nome Ana.")
            .put("pickup_requested_time", "15:30")
            .put("pickup_label", "Cantinho da Adoce")
            .put("instant_order_items", new JSONArray()
                .put(sampleItem("Fatia Ninho", "Calda de Ninho", 18.00, false))
                .put(sampleItem("Fatia Chocolate", "Calda de Chocolate", 18.00, false))
                .put(sampleItem("Fatia Maracuja", "Calda de Maracuja", 18.00, false))));

        samples.add(new JSONObject()
            .put("order_number", "AMOSTRA 3/3 GRANDE")
            .put("created_at", now)
            .put("customer_name", "Cliente Teste Pedido Grande")
            .put("customer_phone", "(85) 90000-0003")
            .put("total", 84.00)
            .put("payment_method_label", "Cartão de crédito")
            .put("customer_notes", "Pedido com seis sabores reais do cardápio. Conferir todas as caldas antes de fechar a embalagem e manter refrigerado.")
            .put("pickup_requested_time", "17:45")
            .put("pickup_label", "Retirada na Adoce")
            .put("instant_order_items", new JSONArray()
                .put(sampleItem("Red Velvet com Geleia de Morango e Ninho", "Calda de Ninho", 16.00, false))
                .put(sampleItem("Doce de Leite com Crocrante com churros", "Calda de chocolate", 16.00, false))
                .put(sampleItem("Galak Trufado com Morangos", "Calda de Ninho", 16.00, false))
                .put(sampleItem("KitKat Dark", "Calda Black", 16.00, false))
                .put(sampleItem("Kinder Bueno", "Calda de chocolate", 20.00, false))
                .put(sampleItem("Prestígio", "Calda Black", 0.00, true))));

        return samples;
    }

    private JSONObject sampleItem(String flavor, String sauce, double unitPrice, boolean reward) throws Exception {
        return new JSONObject()
            .put("flavor_name", flavor)
            .put("quantity", 1)
            .put("unit_price", unitPrice)
            .put("is_reward", reward)
            .put("instant_order_item_sauces", new JSONArray()
                .put(new JSONObject().put("unit_number", 1).put("sauce_name", sauce)));
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
