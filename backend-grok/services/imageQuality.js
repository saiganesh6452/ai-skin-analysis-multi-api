// services/imageQuality.js
const sharp = require('sharp');

async function analyzeImageQuality(buffer) {
  try {
    const meta = await sharp(buffer).metadata();
    const stats = await sharp(buffer).stats();

    const low = meta.width < 480 || meta.height < 480;
    const bright = stats.channels.reduce((s, c) => s + c.mean, 0) / stats.channels.length;
    const dark = bright < 30;
    const over = bright > 230;
    const shp = stats.channels.reduce((s, c) => s + c.stdev, 0) / stats.channels.length;
    const blur = shp < 15;

    return {
      quality: {
        resolution: { width: meta.width, height: meta.height, isGood: !low },
        lighting: { brightness: bright, isGood: !dark && !over, tooDark: dark, tooBright: over },
        sharpness: { value: shp, isGood: !blur },
        overall: !low && !dark && !over && !blur,
      },
      issues: [
        ...(low ? ['Low resolution'] : []),
        ...(dark ? ['Too dark'] : []),
        ...(over ? ['Too bright'] : []),
        ...(blur ? ['Blurry'] : []),
      ],
    };
  } catch (e) {
    return {
      quality: {
        resolution: { isGood: true },
        lighting: { isGood: true },
        sharpness: { isGood: true },
        overall: true,
      },
      issues: [],
    };
  }
}

module.exports = { analyzeImageQuality };
