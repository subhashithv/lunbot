const games = new Map();

function createGame(channelId, p1, p2) {

const key = `${channelId}`;

const attacker = Math.random() < 0.5 ? p1 : p2;
const defender = attacker === p1 ? p2 : p1;

games.set(key,{
players:[p1,p2],
attacker,
defender,
moves:{},
round:1,
score:{
[p1]:0,
[p2]:0
}
});

}

function getGame(channelId){
return games.get(`${channelId}`);
}

function setMove(channelId,userId,move){

const game = games.get(`${channelId}`);
if(!game) return;

if(game.moves[userId]) return;

game.moves[userId] = move;

}

function resetMoves(channelId){

const game = games.get(`${channelId}`);
if(!game) return;

game.moves = {};

}

function deleteGame(channelId){
games.delete(`${channelId}`);
}

module.exports = {
createGame,
getGame,
setMove,
resetMoves,
deleteGame
};