// server.js File
const express = require('express'); // Importing express module

const app = express(); // Creating an express object

const port = 3000;  // Setting an port for this application

const commander = require('commander');
const package = require('./package.json');
const fs = require('fs');
const glob = require('glob');
const path = require("path");
const puppeteer = require('puppeteer');
const httpServer = require("http-server");
const convert2xkt = require("@xeokit/xeokit-convert/dist/convert2xkt.cjs.js");
var cors = require('cors');
var bodyParser = require('body-parser');
var multer = require('multer')
// let projectIds = require("./data/projects/index.json")



app.use(cors())
app.use(express.json())
app.use(bodyParser.urlencoded({
    extended: false
}))


var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'myifcdir')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
})

var upload = multer({ storage: storage }).single('file')


// Starting server using listen function
app.listen(port, function (err) {
    if (err) {
        console.log("Error while starting server");
    }
    else {
        console.log("Server has been started at " + port);
    }
})
app.get("/test",(req,res)=>{
    res.send("server is running on port 3000")
})



app.post('/upload', function (req, res) {

    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            return res.status(500).json(err)
        } else if (err) {
            return res.status(500).json(err)
        }

        return res.status(200).send(req.file)

    })

});


app.post("/convertIfcToXkt", (req, res) => {
    console.log("--file name ---",req.body);

   try {

     
    let filename = req.body.filename
    const SERVER_PORT = 3000;
    const SCREENSHOT_SIZE = [200, 200];
    const HEADLESS = false;

    const date = new Date('14 Jun 2017 00:00:00 PDT');
    const dateUTC = date.toUTCString();

    const chromeOptions = {
        product: 'chrome',
        headless: HEADLESS,
        args: [`--window-size=${SCREENSHOT_SIZE[0]},${SCREENSHOT_SIZE[1]}`],
        defaultViewport: {
            width: SCREENSHOT_SIZE[0],
            height: SCREENSHOT_SIZE[1]
        }
    };

    const program = new commander.Command();

    program.version(package.version, '-v, --version');

    // program
    //     .option('-s, --source [file]', 'path to source model file(s)')
    //     .option('-p, --projectid [string]', 'ID for new project')
    //     .option('-d, --datadir [file]', 'optional path to target data directory - default is "./data"');

    // program.on('--help', () => {

    // });

    // program.parse(process.argv);

    // const options = program.opts();
    let options = {}

    options["source"] = `./myifcdir/${filename}`
    options["projectid"] = filename

    if (options.source === undefined) {
        console.error('\n\nError: please specify path to source model file(s).');
        program.help();
        process.exit(1);
    }

    if (options.projectid === undefined) {
        console.error('\n\nError: please specify project ID.');
        program.help();
        process.exit(1);
    }

    const source = options.source;
    const projectId = options.projectid;
    const dataDir = options.datadir || "./data";
    const projectsDir = `${dataDir}/projects`;
    const projectsIndexPath = `${projectsDir}/index.json`;
    const projectDir = `${projectsDir}/${projectId}`;
    const projectIndexPath = `${projectDir}/index.json`;
    const projectModelsDir = `${projectDir}/models`;

    function log(msg) {
        console.log("[createProject]" + msg);
    }

    createProject().catch(err => {
        console.error('Error:', err);
        res.status(401)
    });

    async function createProject() {

        if (!fs.existsSync(dataDir)) {
            log(`Creating ${dataDir}`);
            fs.mkdirSync(dataDir);
        }

        if (!fs.existsSync(projectsDir)) {
            log(`Creating ${projectsDir}`);
            fs.mkdirSync(projectsDir);
        }

        if (!fs.existsSync(projectDir)) {
            log(`Creating ${projectDir}`);
            fs.mkdirSync(projectDir);
        }

        if (!fs.existsSync(projectsIndexPath)) {

            const projectsIndex = {
                "projects": []
            };

            projectsIndex.projects.push({
                id: projectId,
                name: projectId
            });

            await fs.promises.writeFile(projectsIndexPath, JSON.stringify(projectsIndex, null, "\t"));

        } else {

            const projectsIndex = JSON.parse(await fs.readFileSync(projectsIndexPath));

            if (!projectsIndex.projects) {
                log(`Invalid projects index ("projects" list not found): ${projectsIndexPath}`);
                // res.send(`Invalid projects index ("projects" list not found): ${projectsIndexPath}`)
                return res.status(404).send({
                    status: 404,
                    error: `Invalid projects index ("projects" list not found): ${projectsIndexPath}`
                })
                //process.exit(-1);
            }

            for (let i = 0, len = projectsIndex.projects.length; i < len; i++) {
                const projectInfo = projectsIndex.projects[i];
                if (projectInfo.id === projectId) {
                    log(`Project already exists: "${projectId}"`);
                    // res.send(`Project already exists: "${projectId}"`)
                    // process.exit(1);
                    // res.setHeader('content-type', 'text/plain');
                    return res.send(JSON.stringify({data:"data"}))
                }
            }

            projectsIndex.projects.push({
                id: projectId,
                name: projectId
            });

            log(`Creating new project "${projectId}" ...`);

            fs.writeFileSync(projectsIndexPath, JSON.stringify(projectsIndex, null, "\t"));

        }

        fs.mkdirSync(projectModelsDir);

        const projectIndex = {
            "id": projectId,
            "name": projectId,
            created: dateUTC,
            "models": [],
            "viewerConfigs": {},
            "viewerContent": {},
            "viewerState": {}
        }

        const stats = {};

        const promises = [];

        glob.sync(source).map(async modelSrc => {

            const modelId = path.basename(modelSrc, path.extname(modelSrc));
            const modelDestDir = `${projectDir}/models/${modelId}`;
            const xktDest = `${modelDestDir}/geometry.xkt`;
            const screenshotDestDir = `${projectDir}/models/${modelId}/screenshot/`;
            const sourceDestDir = `${projectDir}/models/${modelId}/source/`;

            if (!fs.existsSync(modelDestDir)) {
                fs.mkdirSync(modelDestDir);
            }

            if (!fs.existsSync(screenshotDestDir)) {
                fs.mkdirSync(screenshotDestDir);
            }

            if (!fs.existsSync(sourceDestDir)) {
                fs.mkdirSync(sourceDestDir);
                //...TODO: copy
            }

            try {

                const projectsIndexModel = {
                    id: modelId,
                    name: modelId,
                    metadata: {}
                };

                projectIndex.models.push(projectsIndexModel);

                promises.push(convert2xkt({
                    source: modelSrc,
                    output: xktDest,
                    outputStats: (stats) => {
                        const metadata = projectsIndexModel.metadata;
                        metadata.sourceFormat = stats.sourceFormat || "";
                        metadata.schemaVersion = stats.schemaVersion || "";
                        metadata.title = stats.title || "";
                        metadata.author = stats.author || "";
                        metadata.created = stats.created || "";
                        metadata.numPropertySets = stats.numPropertySets || 0;
                        metadata.numMetaObjects = stats.numMetaObjects || 0;
                        metadata.numObjects = stats.numObjects || 0;
                        metadata.numTriangles = stats.numTriangles || 0;
                        metadata.numVertices = stats.numVertices || 0;
                        metadata.xktSizeKb = stats.xktSize || 0;
                        metadata.aabb = stats.aabb ? Array.from(stats.aabb) : null;
                    },
                    log: (msg) => {
                        //console.log(msg)
                    }
                }));

            } catch (e) {
                //console.log(e)
            }
        });

        Promise.all(promises).then(() => {
            fs.writeFileSync(projectIndexPath, JSON.stringify(projectIndex, null, "\t"));
            log(`Project "${projectId}" created.`);

            return res.send(`Project ${projectId}created`)
            // process.exit(0);
        });


        async function createScreenshots(testStats) {
            log("Creating screenshots...\n");
            let server = httpServer.createServer();
            server.listen(SERVER_PORT);
            const modelStats = testStats.modelStats;
            for (let i = 0, len = SOURCE_FILES.length; i < len; i++) {
                const fileInfo = SOURCE_FILES[i];
                const modelId = fileInfo.modelId;
                const stats = modelStats[modelId];
                if (!stats) {
                    continue;
                }
                const xktDest = stats.xktDest;
                if (!xktDest) {
                    continue;
                }
                const screenshotDir = `${OUTPUT_DIR}/${modelId}/screenshot`;
                const screenshotPath = `${screenshotDir}/screenshot.png`;
                if (!fs.existsSync(screenshotDir)) {
                    fs.mkdirSync(screenshotDir);
                }
                const browser = await puppeteer.launch(chromeOptions);
                const page = await browser.newPage();
                if (!testStats.browserVersion) {
                    testStats.browserVersion = await page.browser().version();
                }
                await page.setDefaultNavigationTimeout(3000000);
                await page.goto(`http://localhost:${SERVER_PORT}/perfTests/perfTestXKT.html?xktSrc=../${xktDest}`);
                await page.waitForSelector('#percyLoaded')
                const element = await page.$('#percyLoaded')
                const value = await page.evaluate(el => el.innerText, element)
                const pageStats = JSON.parse(value);
                await page.screenshot({ path: screenshotPath });
                await page.close();
                await browser.close();
                stats.loadingTime = pageStats.loadingTime;
                stats.fps = pageStats.fps;
                stats.screenshot = "screenshot.png";
            }
            server.close();
            log("All XKT models tested in xeokit.\n");
        }

    }




       
   } catch (error) {
       console.log("error",error)
       res.status(400).send("400 Bad Request")
   }




})

app.get("/getProjectIds",async (req,res)=>{
    let data =  await JSON.parse(fs.readFileSync('./data/projects/index.json', 'utf-8'))
    let allprojectId = data.projects.map(d=>d.id)
    res.send(allprojectId)

})