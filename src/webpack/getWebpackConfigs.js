const chalk = require("chalk");
const fs = require("fs-extra");
const globPromise = require("glob-promise");
const Spinner = require("cli-spinner").Spinner;
const inquirer = require("inquirer");
const path = require("path");

const createConfigByRichmediarcList = require("./config/createConfigByRichmediarcList");
const saveChoicesInPackageJson = require("../util/saveChoicesInPackageJson");
const findRichmediaRC = require("../util/findRichmediaRC");
const parsePlaceholdersInObject = require("../util/parsePlaceholdersInObject");
const expandWithSpreadsheetData = require("../util/expandWithSpreadsheetData");

module.exports = async function (options) {
  const start = Date.now()

  // {mode = "development", glob = "./**/.richmediarc*", choices = null, stats = null, outputDir = "./build", configOverride = {}}
  let {mode, glob, choices, stats, outputDir} = options;
  console.log(`${chalk.blue("i")} Searching for configs`);

  const spinner = new Spinner("processing.. %s");
  spinner.setSpinnerString("/-\\|");
  spinner.start();

  let configs = await findRichmediaRC(glob, ["settings.entry.js", "settings.entry.html"]);

  spinner.stop(true);

  if (configs.length === 0) {
    throw new Error("could not find a compatible .richmediarc with entry points configured");
  }

  /* only return configs that don't have uniqueHash (uniqueHash means it's a temporary config from googlesheets)
  this is to prevent additional configs being parsed, for example if you run build while running dev in another terminal */
  configs = configs.filter((config) => {
    return !config.data.uniqueHash;
  });

  console.log(`${chalk.green("✔")} Found ${configs.length} config(s)`);
  console.log(`${chalk.green("✔")} Taking a look if it has Spreadsheets`);

  // parse placeholders in content source so it works with spreadsheets
  configs.forEach((config) => {
    if (config.data.settings.contentSource) {
      config.data.settings.contentSource = parsePlaceholdersInObject(config.data.settings.contentSource, config.data);
    }
  });

  configs = await expandWithSpreadsheetData(configs, mode);

  // parse placeholders for everything
  configs.forEach((config) => {
    if (config.data) {
      config.data = parsePlaceholdersInObject(config.data, config.data);
    }
  });
  
  console.log(chalk.green(`Prepared ${configs.length} configs in ${Date.now() - start}ms`));

  const questions = [];

  if (!choices) {
    let answers = {
      location: "all",
    };

    if (mode === "production") {
      const filesBuild = await globPromise(`${outputDir}/**/*`);
      if (filesBuild.length > 0) {
        questions.push({
          type: "confirm",
          name: "emptyBuildDir",
          message: `Empty build dir? ${chalk.red(`( ${filesBuild.length} files in ${path.resolve(outputDir)})`)}`,
        });
      }
    }

    if (configs.length === 1) {
      console.log(`  Choosing ${configs[0].location}`);
      answers.location = configs[0].location;
    } else {
      questions.push({
        type: "checkbox",
        name: "location",
        message: "Please select config(s) build:",
        choices: [
          {name: "all", checked: false},
          ...configs.map((config) => {
            let name = config.location;

            return {
              name,
              checked: false,
            };
          }),
        ],
        validate(answer) {
          if (answer.length < 1) {
            return `${chalk.red("✖ You must choose at least one.")} `;
          }
          return true;
        },
      });
    }

    if (mode === "development") {
      questions.push({
        type: "confirm",
        name: "openLocation",
        message: "Do you want a browser to open to your dev location?",
        default: true,
      });
    }

    answers = {
      ...answers,
      ...(await inquirer.prompt(questions)),
    };

    await saveChoicesInPackageJson(mode === "development" ? "dev" : "build", {
      glob,
      choices: answers,
      stats,
    });

    choices = answers;
  }

  const start2 = Date.now()

  if (choices.emptyBuildDir) {
    await fs.emptyDir(outputDir);
  }

  //create list of configs based on choices
  let configsResult;
  if (choices.location.indexOf("all") > -1) {
    configsResult = configs;
  } else {
    configsResult = configs.filter(({location}) => {
      return choices.location.indexOf(location) > -1;
    });
  }

  //if the richmediarc location doesn't actually exist, assume its a config derived from google spreadsheets, so we write one to disk
  await Promise.all(configsResult.map(async config => {
    let writeConfig = false;
    if (await fs.exists(config.location)) {
      try {
        const configData = await fs.readJson(config.location);
        if (configData.uniqueHash) {
          // this means it's a file marked for deletion (but somehow stayed behind)
          writeConfig = true;
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      writeConfig = true;
    }

    if (writeConfig) {
      const data = Buffer.from(JSON.stringify(config.data));
      await fs.writeFile(config.location, data);
    }
  }));

  let result = await createConfigByRichmediarcList(configsResult, {
    mode,
    stats: false,
    outputDir,
  });

  result = result.map((webpack, index) => {
    return {
      webpack,
      settings: configsResult[index],
    };
  });

  console.log(chalk.green(`${result.length} webpack configs prepared in ${Date.now() - start2}ms`));

  return {
    result, choices
  }

};
