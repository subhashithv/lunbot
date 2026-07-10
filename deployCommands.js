const { REST, Routes } = require("discord.js");
require("dotenv").config();

const fightCommand = require("./commands/fight");
const notifyCommand = require("./commands/notify");

const commands = [
{
name:"fight",
description:"Start a boxing match",
options:[
{
name:"user",
description:"Opponent",
type:6,
required:true
}
]
},
notifyCommand.data.toJSON()
];

const rest = new REST({version:"10"}).setToken(process.env.TOKEN);

(async()=>{

await rest.put(
Routes.applicationCommands(process.env.CLIENT_ID),
{body:commands}
);

console.log("Global commands deployed.");

})();