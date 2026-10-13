package br.com.adocebrigaderia.operacao;

/** Monochrome GS v 0 raster; transparent pixels are composited over white. */
public final class ThermalLogoRaster {
    private ThermalLogoRaster() { }

    public static byte[] encode(int width, int height, int[] argb) {
        if (width < 1 || width > 288 || height < 1 || height > 65535
                || argb == null || argb.length != width * height) {
            throw new IllegalArgumentException("Invalid thermal logo dimensions");
        }
        int rowBytes = (width + 7) / 8;
        byte[] result = new byte[8 + rowBytes * height];
        result[0] = 0x1d; result[1] = 0x76; result[2] = 0x30; result[3] = 0;
        result[4] = (byte) rowBytes; result[5] = (byte) (rowBytes >> 8);
        result[6] = (byte) height; result[7] = (byte) (height >> 8);
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int pixel = argb[y * width + x];
                int alpha = pixel >>> 24;
                int r = ((pixel >> 16 & 255) * alpha + 255 * (255 - alpha)) / 255;
                int g = ((pixel >> 8 & 255) * alpha + 255 * (255 - alpha)) / 255;
                int b = ((pixel & 255) * alpha + 255 * (255 - alpha)) / 255;
                // Preserve chocolate lettering and illustration; pale pink stays white.
                if ((299 * r + 587 * g + 114 * b) / 1000 < 160) {
                    result[8 + y * rowBytes + x / 8] |= (byte) (0x80 >> (x % 8));
                }
            }
        }
        return result;
    }
}
