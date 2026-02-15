const fs = require("fs-extra");
const path = require("path");
const archiver = require("archiver");
const globPromise = require("glob-promise");
const getNameFromLocation = require("../util/getNameFromLocation");
const htmlParser = require("node-html-parser");
const chalk = require("chalk");
const ffmpeg = require('fluent-ffmpeg');
const { imageSize } = require('image-size');

module.exports = async function buildPreview(result, qualities, outputDir) {
  const start = Date.now()
  
  // find all ads in directory
  const allIndexHtmlFiles = await globPromise(`${outputDir}/**/index.html`);

  if (result) {
    result.forEach((e, i) => {
      e.settings.data.settings.bundleName ??= getNameFromLocation(e.settings.location)
      e.quality = qualities[i]
    })
    // result.sort((a, b) => a.settings.data.settings.bundleName > b.settings.data.settings.bundleName ? 1 : -1)
    result = result.reduce((acc, result) => {
      acc[result.settings.data.settings.bundleName] = result
      return acc
    }, {})
  }

  // collect all fs data
  const parentDirsCache = {}

  await Promise.all(
    allIndexHtmlFiles
    .map(filename => path.resolve(path.dirname(filename), '../'))
    .filter((x, i, a) => a.indexOf(x) == i)
    .map(async parentDir => {
      const filesInParentDir = await fs.readdir(parentDir)
      const fileStatsInParentDir = await Promise.all(
        filesInParentDir.map(async file => {
          return await fs.stat(path.resolve(parentDir, file))
        })
      )
      parentDirsCache[parentDir] = {
        files: filesInParentDir,
        stats: fileStatsInParentDir
      }
    })
  )

  const allAds = (await Promise.all(
    allIndexHtmlFiles.map(async (filename, i) => {
      const rawData = await fs.readFile(filename, "utf8");
      const parsed = htmlParser.parse(rawData);

      if (!parsed.querySelectorAll('meta[name="ad.size"]').length) {
        return undefined;
      }

      const dimensions = parsed.querySelector('meta[name="ad.size"]').getAttribute('content').split(',').reduce((acc, attr) => {
        const keyVal = attr.split('=');
        return {
          ...acc,
          [keyVal[0]]: keyVal[1]
        }
      }, {});

      const bundleName = path.basename(path.dirname(filename));
      const bundleParentDir = path.resolve(path.dirname(filename), '../');
      const { files, stats } = parentDirsCache[bundleParentDir]
      const filesInParentDir = files;

      const additionalOutputs = (await Promise.all(
        filesInParentDir.map(async (file, i) => {
          const fileStats = stats[i];

          if (fileStats.isFile() && file.includes(bundleName)) {
            const fileType = path.extname(file).split('.')[1];
            return {
              [fileType]: {
                // url: file,
                url: path.relative(outputDir, path.resolve(bundleParentDir, file)).replace(/\\/g, "/"),
                size: fileStats.size
              }
            }
          }

          if (file === bundleName) {
            if (result && result[bundleName] && result[bundleName].settings.data.settings.optimizeUncompressed) {
              return {
                unzip: {
                  size: await size(path.resolve(bundleParentDir, file))
                }
              }
            }
          }

          return undefined
        })
      ))
      .filter(output => output != undefined)
      .reduce((a, v) => ({ ...a, ...v }), {}) // array to object

      return {
        bundleName,
        ...dimensions,
        maxFileSize: (result && result[bundleName])
          ? result[bundleName].settings.data.settings.maxFileSize
          : undefined,
        quality: (result && result[bundleName])
          ? result[bundleName].quality || (result[bundleName].settings.data.settings?.optimizations?.image && 80) || 100
          : undefined,
        output: {
          html: {
            url: path.relative(outputDir, filename).replace(/\\/g, "/")
          },
          ...additionalOutputs
        },
        info: (result && result[bundleName])
          ? result[bundleName].settings.data.settings.info
          : undefined,
        client: (result && result[bundleName])
          ? result[bundleName].settings.data.settings.client
          : undefined,
        controlsOff: (result && result[bundleName])
          ? result[bundleName].settings.data.settings.controlsOff
          : undefined
      }
    })
  ))
  .filter(ad => ad != undefined)

  const alreadyProcessed = allAds.map(ad => ad.bundleName)
  const topLevelFilesInBuild = (await fs.readdir(outputDir))
    .map(file => path.resolve(outputDir, file)) // relative to full path
    .filter(file => {
      const stats = fs.statSync(file)
      return stats.isFile()
    }) // only files, skip dirs
    .filter(file => {
      const filename = path.basename(file).replace(path.extname(file), '')
      return !alreadyProcessed.includes(filename)
    }) // filter out processed files
    .filter(file => path.extname(file) != '.zip')
    .filter(file => path.extname(file) != '.html')
    .filter(file => path.extname(file) != '.svg')
    .filter(file => {
      const filename = path.basename(file)
      return ![
        'Favicon_black_32X32.png',
        'Monks-Logo_Small_White.png',
      ].includes(filename)
    })
    .map(file => path.basename(file).replace(path.extname(file), ''))
    .filter((x, i, a) => a.indexOf(x) == i)
    .filter( file => file !== '.DS_Store')

  const mediaOutputs = await Promise.all(topLevelFilesInBuild.map(async file => {
    const jpgFile = path.resolve(outputDir, file) + '.jpg'
    const mp4File = path.resolve(outputDir, file) + '.mp4'
    const gifFile = path.resolve(outputDir, file) + '.gif'

    const jpg = await additionalOutput(jpgFile)
    const mp4 = await additionalOutput(mp4File)
    const gif = await additionalOutput(gifFile)

    async function additionalOutput(file) {
      return await new Promise(async resolve => {
        if (await fs.exists(file)) {
          return resolve({
            url: path.relative(outputDir, path.resolve(file)).replace(/\\/g, "/"),
            size: (await fs.stat(file)).size
          })
        }

        resolve()
      })
    }

    async function getDimensions() {
      for (const [format, file, fn] of [
        [jpg, jpgFile, getImageDimensions],
        [mp4, mp4File, getVideoDimensions],
        [gif, gifFile, getVideoDimensions]
      ]) {
        if (format) {
          return await fn(file)
        }
      }
    }

    const { width, height } = await getDimensions()

    return {
      bundleName: file,
      width,
      height,
      output: {
        jpg,
        mp4,
        gif,
      }
    }
  }))

  const client = result && result[Object.keys(result)[0]]?.settings.data.settings.client

  const adsList = {
    timestamp: Date.now(),
    client: client
      ? `client.${client.split('.').at(-1)}`
      : undefined,
    ads: allAds.concat(mediaOutputs)
  };

  console.log(`found ${allAds.length} for previews.`)

  // copy preview folder
  console.log("copying preview files...");
  await fs.copy(path.join(__dirname, `../preview/dist`), outputDir, {
    overwrite: true,
  });
  
  // copy client logo
  if (client) {
    console.log("copying client logo...");
    await fs.copy(client, path.join(outputDir, `client.${client.split('.').at(-1)}`), {
      overwrite: true,
    });
  }

  // write the result to ads.json in the preview dir
  console.log(`creating ${outputDir}/data/ads.json`)
  await fs.outputFile(path.resolve(outputDir, 'data/ads.json'), JSON.stringify(adsList, null, 2));

  // write the zip file containing all zips
  if (adsList.ads.filter(ad => ad.output.zip).length > 0) {
    console.log(`creating all.zip`)
    await new Promise((resolve) => {
      const output = fs.createWriteStream(outputDir + "/all.zip");
      output.on("close", resolve);
      const archive = archiver("zip", {
        zlib: {level: 9}, // Sets the compression level.
      });
      archive.pipe(output);
      adsList.ads.forEach((ad) => {
        if (ad.output.zip) {
          archive.file(path.resolve(outputDir, ad.output.zip.url), {name: path.basename(ad.output.zip.url)})
        }
      });
      archive.finalize();
    });
  }

  console.log(chalk.green(`Preview built in ${Date.now() - start}ms`));
};

function sizeSync(p) {
  const stat = fs.statSync(p);
  if (stat.isFile())
    return stat.size;
  else if (stat.isDirectory())
    return fs.readdirSync(p).reduce((a, e) => a + sizeSync(path.join(p, e)), 0);
  else return 0; // can't take size of a stream/symlink/socket/etc
}

async function size(p) {
  const stat = await fs.stat(p)

  if (stat.isFile())
    return stat.size

  if (stat.isDirectory()) {
    const dir = await fs.readdir(p)
    return (await Promise.all(
      dir.map(async e => await size(path.join(p, e)))
    )).reduce((a, e) => a + e, 0)
  }

  return 0; // can't take size of a stream/symlink/socket/etc
}

function getVideoDimensions(file) {
  return new Promise(resolve => {
    ffmpeg.ffprobe(file, (err, metadata) => {
      const { width, height } = metadata.streams.find(s => s.codec_type === 'video')
      resolve({ width, height })
    })
  })
}

async function getImageDimensions(file) {
  const data = await fs.readFile(file)
  const { width, height } = imageSize(data)
  return { width, height }
}
