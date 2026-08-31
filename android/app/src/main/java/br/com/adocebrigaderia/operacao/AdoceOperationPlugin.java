package br.com.adocebrigaderia.operacao;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "AdoceOperation",
    permissions = {
        @Permission(alias = "bluetooth", strings = {
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_CONNECT
        }),
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class AdoceOperationPlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 31 && getPermissionState("bluetooth") != PermissionState.GRANTED) {
            requestPermissionForAlias("bluetooth", call, "startBluetoothPermissionResult");
            return;
        }
        String url = call.getString("supabaseUrl", "");
        String key = call.getString("publishableKey", "");
        String access = call.getString("accessToken", "");
        String refresh = call.getString("refreshToken", "");
        if (url.isEmpty() || key.isEmpty() || access.isEmpty() || refresh.isEmpty()) {
            call.reject("Sessao nativa incompleta.");
            return;
        }
        AdoceOrderService.saveSession(getContext(), url, key, access, refresh);
        Intent intent = new Intent(getContext(), AdoceOrderService.class).setAction(AdoceOrderService.ACTION_START);
        ContextCompat.startForegroundService(getContext(), intent);
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationPermissionResult");
        } else {
            call.resolve();
        }
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void startBluetoothPermissionResult(PluginCall call) {
        if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
            call.reject("O Bluetooth e necessario para manter a impressora conectada.");
            return;
        }
        start(call);
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void notificationPermissionResult(PluginCall call) { call.resolve(); }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), AdoceOrderService.class));
        AdoceOrderService.clearSession(getContext());
        call.resolve();
    }

    @PluginMethod
    public void discoverPrinter(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 31 && getPermissionState("bluetooth") != PermissionState.GRANTED) {
            requestPermissionForAlias("bluetooth", call, "bluetoothPermissionResult");
            return;
        }
        startDiscovery(call);
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void bluetoothPermissionResult(PluginCall call) {
        if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
            call.reject("Permissao Bluetooth negada.");
            return;
        }
        startDiscovery(call);
    }

    private void startDiscovery(PluginCall call) {
        Intent intent = new Intent(getContext(), AdoceOrderService.class).setAction(AdoceOrderService.ACTION_DISCOVER);
        ContextCompat.startForegroundService(getContext(), intent);
        JSObject result = new JSObject();
        result.put("printer", "procurando");
        call.resolve(result);
    }

    @PluginMethod
    public void printTest(PluginCall call) {
        Intent intent = new Intent(getContext(), AdoceOrderService.class).setAction(AdoceOrderService.ACTION_TEST);
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(AdoceOrderService.status(getContext()));
    }
}
