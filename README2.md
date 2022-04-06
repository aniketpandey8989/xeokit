# Xeokit  application
## Clone this project
`git clone https://github.com/jss-codd/xeokit.git`
- git checkout to `binviewer` branch
- install all the dependencies by run command `npm install`
- start locally `npm run start`
- it  will start server at port 3000 and http server at port  3002


## deploy
- connect to server
- checkout to `iot_anik_latest folder`
- then checkout to `xeokit-viewer/xeokit`
- install the dependencies by run commad `npm install`
- Start the pm2 service: `pm2 start npm --name xeokit -- start`
