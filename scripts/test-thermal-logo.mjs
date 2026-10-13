import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const check = spawnSync(process.execPath, ['scripts/verify-primary-workspace.mjs'], { cwd: root, stdio: 'inherit' });
assert.equal(check.status, 0);
const folder = resolve(root, 'android/build/thermal-logo-test');
mkdirSync(folder, { recursive: true });
const source = resolve(folder, 'ThermalLogoRasterTest.java');
writeFileSync(source, `import br.com.adocebrigaderia.operacao.ThermalLogoRaster;
import java.util.Arrays;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import java.io.File;
public class ThermalLogoRasterTest {
  static void check(boolean ok, String message) { if (!ok) throw new AssertionError(message); }
  public static void main(String[] args) throws Exception {
    byte[] raster = ThermalLogoRaster.encode(9, 2, new int[]{
      0xff000000, 0xffffffff, 0x00000000, 0xffffd9d1, 0xff44220f,
      0x80000000, 0xff000000, 0xffffffff, 0xff000000,
      0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff,
      0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff });
    check(Arrays.equals(raster, new byte[]{29,118,48,0,2,0,2,0,(byte)0x8e,(byte)0x80,0,0}), "raster header, alpha, pink, bit order and padding");
    try { ThermalLogoRaster.encode(289, 1, new int[289]); throw new AssertionError("oversize accepted"); }
    catch (IllegalArgumentException expected) { }
    BufferedImage original = ImageIO.read(new File(args[0]));
    BufferedImage scaled = new BufferedImage(192, 192, BufferedImage.TYPE_INT_ARGB);
    java.awt.Graphics2D graphics = scaled.createGraphics();
    graphics.drawImage(original, 0, 0, 192, 192, null); graphics.dispose();
    byte[] logo = ThermalLogoRaster.encode(192,192,scaled.getRGB(0,0,192,192,null,0,192));
    check(logo.length == 8 + 24 * 192, "official raster dimensions");
    int black = 0;
    BufferedImage preview = new BufferedImage(192,192,BufferedImage.TYPE_INT_RGB);
    for(int y=0;y<192;y++) for(int x=0;x<192;x++) {
      boolean ink = (logo[8+y*24+x/8] & (0x80 >> (x%8))) != 0;
      if (ink) black++; preview.setRGB(x,y,ink ? 0 : 0xffffff);
    }
    check(black > 3000 && black < 18000, "official logo retains artwork without dark background");
    check(preview.getRGB(0,0)==0xffffffff, "transparent corner is white");
    ImageIO.write(preview,"png",new File(args[1]));
    System.out.println("Thermal logo byte tests passed; black pixels=" + black);
  }
}`);
const helper = resolve(root, 'android/app/src/main/java/br/com/adocebrigaderia/operacao/ThermalLogoRaster.java');
for (const [command, args] of [
  ['javac', ['-d', folder, helper, source]],
  ['java', ['-cp', folder, 'ThermalLogoRasterTest', resolve(root, 'public/wallet/brand/logo-transparent.png'), resolve(folder, 'preview.png')]],
]) {
  const run = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  assert.equal(run.status, 0, `${command} failed`);
}
assert.deepEqual(readFileSync(resolve(root, 'public/wallet/brand/logo-transparent.png')),
  readFileSync(resolve(root, 'android/app/src/main/res/drawable-nodpi/thermal_adoce_logo.png')));
