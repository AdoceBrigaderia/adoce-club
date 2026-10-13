package br.com.adocebrigaderia.operacao;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AdoceOperationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
