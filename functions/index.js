require("dotenv").config();
const admin = require("firebase-admin");
const functions = require("firebase-functions");
admin.initializeApp(functions.config().firebase);

const mqtt = require("mqtt");
const url = require("url");
const db = admin.database();

const { dialogflow } = require("actions-on-google");

const app = dialogflow({
  clientId: process.env.AOG_CLIENT_ID
});

const roomId = "-LRL6C7nA1kNGp29Synf";
const roomRef = db.ref("rooms").child(roomId);

app.intent("Default Welcome Intent", welcome);
// Device controlling intent
app.intent("homeless.lights.switch.off", switchOffLights);
app.intent("homeless.lights.switch.on", switchOnLights);
app.intent("homeless.air.switch.on", turnOnAirConditioner);
app.intent("homeless.air.switch.off", turnOffAirConditioner);
app.intent("homeless.door.toggle", doorToggle);

// Device checking intent
app.intent("homeless.check.room.status", roomStatusCheck);
app.intent("homeless.check.door.status", doorStatusCheck);
app.intent("homeless.check.air.status", airStatusCheck);
app.intent("homeless.check.light.status", lightStatusCheck);

// Operation functions
async function switchOffLights(conv, params) {
  if (params.room !== "all room") {
    conv.ask(`Switching off the ${params.room} light.`);
    await roomRef.child(`${params.room}LightStatus`).transaction(status => false);
  } else {
    conv.ask("Switching off all lights.");
    await roomRef.child("bathroomLightStatus").transaction(status => false);
    await roomRef.child("bedroomLightStatus").transaction(status => false);
  }
  console.log(params);
}

async function switchOnLights(conv, params) {
  if (params.room !== "all room") {
    conv.ask(`Switching on the ${params.room} light.`);
    await roomRef
      .child(`${params.room}LightStatus`)
      .transaction(status => true);
  } else {
    conv.ask("Switching on all lights.");
    await roomRef.child("bathroomLightStatus").transaction(status => true);
    await roomRef.child("bedroomLightStatus").transaction(status => true);
  }
  console.log(params);
}

async function turnOnAirConditioner(conv, params) {
  await roomRef.child("airStatus").transaction(_ => true);
  conv.ask("Turning on the air conditioner");
}

async function turnOffAirConditioner(conv, params) {
  await roomRef.child("airStatus").transaction(_ => false);
  conv.ask("Turning off the air conditioner");
}

async function doorToggle(conv, params) {
  const status = params["door-status"];
  await roomRef.child("doorStatus").transaction(_ => (status === "lock" ? true : false));
  conv.ask(`${status === "lock" ? "Locking" : "Unlocking"} the door.`);
  console.log(params);
}

// Monitoring functions

// Tested
async function roomStatusCheck(conv, _) {
  const room = (await roomRef.once("value")).val();

  let result = `Here is your room status.`;
  if (room["airStatus"]) {
    result += `Currently, the air conditioner is on and its temperature is ${
      room["temp"]
    }. `;
  } else {
    result += "Your air conditioner is currently off. ";
  }

  if (room["bathroomLightStatus"] && room["bedroomLightStatus"]) {
    result += "All your lights is on. ";
  } else if (!room["bathroomLightStatus"] && !room["bedroomLightStatus"]) {
    result += "All your lights is turned off. ";
  } else {
    result += `The bedroom light is ${
      room["bedroomLightStatus"] ? "on" : "off"
    } and the bath room light is ${
      room["bathroomLightStatus"] ? "on" : "off"
    }. `;
  }

  if (room["doorStatus"]) {
    result += `Your door is locked safely. Do you want me to do anything further? `;
  } else {
    result += `The door is currently unlocked. It's quite unsafe to let your door unlocked. Do you want me to take any action?`;
  }
  conv.ask(result);
}
// Tested
async function airStatusCheck(conv, _) {
    const airStatus = (await roomRef.child('airStatus').once('value')).val();
    conv.ask(`Your air conditioner is currently ${airStatus ? 'on' : 'off'}.`);
}
// Tested
async function doorStatusCheck(conv, _) {
    const doorStatus = (await roomRef.child('doorStatus').once('value')).val();
    conv.ask(`The door is ${doorStatus ? 'locked' : 'unlocked'}.`);
}
// Tested
async function lightStatusCheck(conv, _) {
    const roomDetail = (await roomRef.once('value')).val();
    const bedroom = roomDetail['bedroomLightStatus'];
    const bathroom = roomDetail['bathroomLightStatus'];
    conv.ask(`The bathroom light is ${bathroom ? 'on' : 'off'} and the bedroom light is ${bedroom ? 'on' : 'off'}.`);
}

// Tested
function welcome(conv) {
  console.log("request is get");
  conv.ask("Welcome to our room. You can control room actions via this app.");
}

exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);
