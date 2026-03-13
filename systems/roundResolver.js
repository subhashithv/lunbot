function resolveRound(attackerMove,defenderMove){

if(attackerMove === "black" && defenderMove === "dodge")
return "defender";

if(attackerMove === "black" && defenderMove === "block")
return "attacker";

if(attackerMove === "white" && defenderMove === "block")
return "defender";

if(attackerMove === "white" && defenderMove === "dodge")
return "attacker";

}

module.exports = { resolveRound };