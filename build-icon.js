const fs = require("fs");
const { PNG } = require("pngjs");
const pngToIco = require("png-to-ico").default;

const size = 256;
const png = new PNG({ width: size, height: size });

function pixel(x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const index = (size * y + x) << 2;
  png.data[index] = color[0];
  png.data[index + 1] = color[1];
  png.data[index + 2] = color[2];
  png.data[index + 3] = color[3];
}

function diamond(centerX, centerY, radius, color) {
  for (let y = -radius; y <= radius; y += 1) {
    const width = radius - Math.abs(y);
    for (let x = -width; x <= width; x += 1) {
      pixel(centerX + x, centerY + y, color);
    }
  }
}

for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    const distance = Math.hypot(x - 128, y - 128);
    const alpha = distance < 116 ? 255 : 0;
    pixel(x, y, [4, 11, 20, alpha]);
  }
}

diamond(128, 128, 94, [2, 132, 199, 255]);
diamond(128, 128, 76, [5, 11, 20, 255]);
diamond(128, 128, 50, [56, 189, 248, 255]);
diamond(128, 128, 34, [5, 11, 20, 255]);

png
  .pack()
  .pipe(fs.createWriteStream("build/icon.png"))
  .on("finish", async () => {
    const ico = await pngToIco(["build/icon.png"]);
    fs.writeFileSync("build/icon.ico", ico);
  });
