'use strict';

const fs = require('fs-extra');
const path = require('path');
const archiver = require('archiver')
const sharp = require('sharp');
const chalk = require('chalk');

module.exports = class OptimizeBundleToFilesizePlugin {
  constructor(options) {
    this.options = options;
  }

  apply(compiler) {
    compiler.hooks.afterEmit.tapPromise('OptimizeBundleToFilesizePlugin', async compilation => {
      const {outputPath, filename, maxFileSize, optimizeUncompressed, lowestQuality} = this.options;
      const srcDir = compilation.compiler.outputPath;

      if (optimizeUncompressed) {
        const folderSizeInit = await size(path.resolve(srcDir))

        if (folderSizeInit <= maxFileSize) {
          // console.log('looks like the bundle is already small enough, does not need additional optimization')
          compilation.quality = 100
        } else {
          const inputFiles = await fs.readdir(path.resolve(srcDir))

          const filesData = await Promise.all(
            inputFiles
            .filter(file => ['.jpg', '.png', '.jpeg'].includes(path.extname(file)))
            .map(file => {
              return new Promise(async res => {
                const data = await fs.promises.readFile(path.resolve(srcDir, file))
                res({
                  name: file,
                  data
                })
              })
            })
          )

          const filesDataTotalSize = filesData.reduce((a, f) => a + f.data.length, 0)

          const baseSize = folderSizeInit - filesDataTotalSize

          // otherwise continue with the optimization loop...
          await (async function optimizeToSize(srcDir, outputPath, filename, maxFileSize, hq, lq) {
            const quality = Math.floor((hq + lq) / 2)
            // console.log(`\n\n\n\n\n\n\n\n\n\n\ncreating bundle with ${quality} quality level...`)

            const optimizedFilesData = await Promise.all(
              filesData
              .map(async file => {
                const optimizedContentBuffer = path.extname(file.name) === '.png' ?
                  await sharp(file.data).png({quality, effort: 10}).toBuffer() :
                  await sharp(file.data).jpeg({quality}).toBuffer()

                return {
                  name: file.name,
                  data: optimizedContentBuffer
                }
              })
            )

            const optimizedFilesDataTotalSize = optimizedFilesData.reduce((a, f) => a + f.data.length, 0)

            const folderSize = baseSize + optimizedFilesDataTotalSize

            if (hq - lq < 2) {
              await Promise.all(optimizedFilesData.map(async file => {
                await fs.promises.writeFile(path.resolve(srcDir, file.name), file.data);
              }))

              if (quality == lowestQuality) {
                console.log(chalk.red(
`\nCan't optimize ${filename} to ${maxFileSize/1024}KB with ${lowestQuality} lowest quality.
Best result is: ${(folderSize/1024).toFixed(1)} KB.
Consider lowering lowestImageQuality or compressing assets using external utilities.`));
              }
              
              compilation.quality = quality
              return
            }

            if (folderSize > maxFileSize) {
              await optimizeToSize(srcDir, outputPath, filename, maxFileSize, quality, lq)
            } else {
              await optimizeToSize(srcDir, outputPath, filename, maxFileSize, hq, quality)
            }
          })(srcDir, outputPath, filename, maxFileSize, 100, lowestQuality);
        }

        // and finally create zip
        await new Promise(async resolve => {
          const output = fs.createWriteStream(path.resolve(outputPath, filename));
          output.on("close", () => {
            resolve(path.resolve(outputPath, filename));
          });
          const archive = archiver("zip", {zlib: {level: 9}});
          archive.pipe(output);
          const inputFiles = await fs.promises.readdir(path.resolve(srcDir))
          inputFiles.forEach(file => {
            archive.file(path.resolve(srcDir, file), {name: file})
          })
          archive.finalize();
        })

        return
      }

      // build a zip first and see if it's under maxFileSize
      const zippedBundle = await new Promise(async resolve => {
        const output = fs.createWriteStream(path.resolve(outputPath, filename));
        output.on("close", () => {
          resolve(path.resolve(outputPath, filename));
        });
        const archive = archiver("zip", {zlib: {level: 9}});
        archive.pipe(output);
        const inputFiles = await fs.promises.readdir(path.resolve(srcDir))
        inputFiles.forEach(file => {
          archive.file(path.resolve(srcDir, file), {name: file})
        })
        archive.finalize();
      })

      const zippedBundleSize = (await fs.stat(zippedBundle)).size;

      if (zippedBundleSize <= maxFileSize) {
        // console.log('looks like the bundle is already small enough, does not need additional optimization')
        compilation.quality = 100
      } else {
        // otherwise continue with the optimization loop...
        await (async function optimizeToSize(srcDir, outputPath, filename, maxFileSize, hq, lq) {
          const quality = Math.floor((hq + lq) / 2)
          // console.log(`\n\n\n\n\n\n\n\n\n\n\ncreating bundle with ${quality} quality level...`)

          const zippedBundle = await new Promise(async resolve => {
            const output = fs.createWriteStream(path.resolve(outputPath, filename));
            output.on("close", () => resolve({
              filename: path.resolve(outputPath, filename),
              files: optimizedResult
            }));
            const archive = archiver("zip", {zlib: {level: 9}});
            archive.pipe(output);

            const inputFiles = await fs.readdir(path.resolve(srcDir))

            const optimizedResult = await Promise.all(inputFiles.map(async file => {
              return new Promise(async resolve => {
                const result = await (async () => {
                  if (['.jpg', '.png', '.jpeg'].includes(path.extname(file))) {
                    const content = await fs.promises.readFile(path.resolve(srcDir, file));
                    const optimizedContentBuffer = path.extname(file) === '.png' ?
                      await sharp(content).png({quality, effort: 10}).toBuffer() :
                      await sharp(content).jpeg({quality}).toBuffer()

                    archive.append(optimizedContentBuffer, {name: file});
                    return {
                      name: file,
                      buffer: optimizedContentBuffer,
                    }

                  } else {
                    archive.file(path.resolve(srcDir, file), {name: file})
                    return {name: file};
                  }
                })();
                resolve(result);
              })
            }))
            archive.finalize();
          })

          const zippedBundleSize = (await fs.stat(zippedBundle.filename)).size;

          if (hq - lq < 2) {
            await Promise.all(zippedBundle.files.filter(file => file.buffer).map(async file => {
              await fs.promises.writeFile(path.resolve(srcDir, file.name), file.buffer);
            }))

            if (quality == lowestQuality) {
              console.log(chalk.red(
`\nCan't optimize ${filename} to ${maxFileSize/1024}KB with ${lowestQuality} lowest quality.
Best result is: ${(zippedBundleSize/1024).toFixed(1)} KB.
Consider lowering lowestImageQuality or compressing assets using external utilities.`));
            }

            compilation.quality = quality

            return
          }

          if (zippedBundleSize > maxFileSize) {
            await optimizeToSize(srcDir, outputPath, filename, maxFileSize, quality, lq)
          } else {
            await optimizeToSize(srcDir, outputPath, filename, maxFileSize, hq, quality)
          }
        })(srcDir, outputPath, filename, maxFileSize, 100, lowestQuality);
      }
    });
  }
};

function sizeSync(p) {
  const stat = fs.statSync(p)

  if (stat.isFile())
    return stat.size

  if (stat.isDirectory())
    return fs.readdirSync(p).reduce((a, e) => a + sizeSync(path.join(p, e)), 0)

  return 0; // can't take size of a stream/symlink/socket/etc
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
