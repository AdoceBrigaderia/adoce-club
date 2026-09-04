package br.com.adocebrigaderia.operacao;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
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
    public void pause(PluginCall call) {
        getContext().stopService(new Intent(getContext(), AdoceOrderService.class));
        call.resolve();
    }

    @PluginMethod
    public void clearSession(PluginCall call) {
        getContext().stopService(new Intent(getContext(), AdoceOrderService.class));
        AdoceOrderService.clearSession(getContext());
        call.resolve();
    }

    @PluginMethod
    public void getBiometricStatus(PluginCall call) {
        int authenticators = BiometricManager.Authenticators.BIOMETRIC_WEAK
            | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
        int status = BiometricManager.from(getContext()).canAuthenticate(authenticators);
        JSObject result = new JSObject();
        result.put("available", status == BiometricManager.BIOMETRIC_SUCCESS);
        result.put("savedSession", AdoceOrderService.hasSavedSession(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void unlockWithBiometrics(PluginCall call) {
        if (!AdoceOrderService.hasSavedSession(getContext())) {
            call.reject("Entre uma vez com sua senha para ativar a biometria.");
            return;
        }
        if (!(getActivity() instanceof FragmentActivity)) {
            call.reject("A biometria nao esta disponivel neste aparelho.");
            return;
        }
        int authenticators = BiometricManager.Authenticators.BIOMETRIC_WEAK
            | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
        if (BiometricManager.from(getContext()).canAuthenticate(authenticators)
            != BiometricManager.BIOMETRIC_SUCCESS) {
            call.reject("Cadastre a biometria ou o bloqueio de tela nas configuracoes do tablet.");
            return;
        }
        FragmentActivity activity = (FragmentActivity) getActivity();
        activity.runOnUiThread(() -> {
            BiometricPrompt prompt = new BiometricPrompt(
                activity,
                ContextCompat.getMainExecutor(activity),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(
                        @NonNull BiometricPrompt.AuthenticationResult result
                    ) {
                        super.onAuthenticationSucceeded(result);
                        call.resolve(AdoceOrderService.savedSession(getContext()));
                    }

                    @Override
                    public void onAuthenticationError(
                        int errorCode,
                        @NonNull CharSequence errorText
                    ) {
                        super.onAuthenticationError(errorCode, errorText);
                        call.reject("Entrada biometrica cancelada.");
                    }
                }
            );
            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("Entrar na Operacao Adoce")
                .setSubtitle("Confirme sua biometria ou o bloqueio do tablet")
                .setAllowedAuthenticators(authenticators)
                .setConfirmationRequired(false)
                .build();
            prompt.authenticate(info);
        });
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
    public void printSamples(PluginCall call) {
        Intent intent = new Intent(getContext(), AdoceOrderService.class).setAction(AdoceOrderService.ACTION_SAMPLES);
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
    }

    @PluginMethod
    public void printLargeSample(PluginCall call) {
        Intent intent = new Intent(getContext(), AdoceOrderService.class).setAction(AdoceOrderService.ACTION_LARGE_SAMPLE);
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
    }

    @PluginMethod
    public void printPendingOrders(PluginCall call) {
        Intent intent = new Intent(getContext(), AdoceOrderService.class).setAction(AdoceOrderService.ACTION_PRINT_PENDING);
        ContextCompat.startForegroundService(getContext(), intent);
        call.resolve();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(AdoceOrderService.status(getContext()));
    }
}
