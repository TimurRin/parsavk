console.log("|==================================|");
console.log("|    PARSAVK                       |");
console.log("|             by Cinnabar Forge    |");
console.log("|==================================|");

var START_STR = 'PARSAVK is enabled';
var STOP_STR = 'PARSAVK is disabled';

var Telegram = require('node-telegram-bot-api');
var yargs = require('yargs');
var https = require('https');

const request = require('request');

var argv = yargs
	.usage('Usage: $0 [options]')

	.alias('c', 'config')
	.describe('c', 'Use config from given path')

	.alias('h', 'help')
	.help()
	.strict()
	.argv;

var path = require('path');
var os = require('os');
var fs = require('fs');

var configPath = argv.c || path.join(os.homedir(), 'parsavk', 'config', 'config.js')
	try {
		console.log("Loading config (" + configPath + ")...");
		var config = require(configPath);
		console.log("SUCCESS: Config has been loaded");
	} catch (e) {
		console.log("ERROR: Can't open config file: " + e);
		process.exit(1);
	}

	console.log("Posting to VK, initializing static query...");
var VK_STATIC_QUERY = 'v=5.103&access_token=' + config.vk.token;

var tg = new Telegram(config.telegram.token, {
		polling: true
	});

var tgChats = [];

var chatsPath = configPath + '.chatIds.json';
var writeTgChats = function () {
	fs.writeFileSync(chatsPath, JSON.stringify(tgChats));
};
try {
	console.log("Loading chats list (" + chatsPath + ")...");
	tgChats = require(chatsPath);
	console.log("SUCCESS: Chats list has been loaded");
} catch (e) {
	console.log("ERROR: Can't open chats list file: " + e);
	writeTgChats();
}

var vkWallPosts = {
	"list": [],
	"current": 0,
	"posts": {},
	"groupNameCache": {}
};
var vkWallPostsPath = configPath + '.vkPosts.json';
var writeVkWallPosts = function () {
	fs.writeFileSync(vkWallPostsPath, JSON.stringify(vkWallPosts));
};
try {
	console.log("Loading VK posts list (" + vkWallPostsPath + ")...");
	vkWallPosts = require(vkWallPostsPath);
	console.log("SUCCESS: VK posts list has been loaded");
	if (!vkWallPosts.list) {
		vkWallPosts.list = [];
		console.log("WARNING: 'list' array wasn't inited");
	}
	if (!vkWallPosts.current) {
		vkWallPosts.current = 0;
	}
	if (!vkWallPosts.posts) {
		vkWallPosts.posts = {};
		console.log("WARNING: 'posts' array wasn't inited");
	}
	if (!vkWallPosts.groupNameCache) {
		vkWallPosts.groupNameCache = {};
		console.log("WARNING: 'groupNameCache' array wasn't inited");
	}
} catch (e) {
	console.log("WARNING: Can't open VK posts list file, creating new one: " + e);
	writeVkWallPosts();
}

var telegram_send_chat = function (chatId, msg) {
	console.log('Sending to Telegram chat ' + chatId + ': ' + msg);

	tg.sendMessage(chatId, msg, {
		disable_web_page_preview: true,
		parse_mode: 'markdown'
	});
};

function sendAllPostsToTelegram(v) {
	var s = "";
	if (v == 0) {
		s += "Все сохранённые посты (" + vkWallPosts.list.length + "):\n\n";
		s += "️💬: кол-во комментов\n";
		for (const name in config.emoji) {
			s += config.emoji[name] + ": комменты от " + name + "\n";
		}
		s += "️⚠: комменты не проверялись\n";
		s += "⏳: нет комментов\n";
		s += "️\n";
	}
	for (var i = v; i < vkWallPosts.list.length; i++) {
		var currentGroupPost = vkWallPosts.list[i];
		var currentGroupPostParsed = parsePostKey(currentGroupPost);
		s += (i + 1) + ". ";
		s += "[";
		s += vkWallPosts.groupNameCache[currentGroupPostParsed[0]];
		s += "]";
		s += "(";
		s += "https://vk.com/wall";
		s += currentGroupPostParsed[0];
		s += "_";
		s += currentGroupPostParsed[1];
		s += ")";
		if (vkWallPosts.posts[currentGroupPost].count > 0) {
			s += " 💬 " + vkWallPosts.posts[currentGroupPost].count;
			if (vkWallPosts.posts[currentGroupPost].ourComments) {
				for (const user in vkWallPosts.posts[currentGroupPost].ourComments) {
					if (config.emoji[config.vk.profiles[parseInt(user)]]) {
						s += " " + config.emoji[config.vk.profiles[parseInt(user)]];
					}
				}
			}
		} else if (vkWallPosts.posts[currentGroupPost].count == -1) {
			s += " ⚠️";
		} else {
			s += " ⏳";
		}
		s += "\n";
		if (s.length >= 3072 && (i + 1) < vkWallPosts.list.length) {
			telegram_post(s, 'markdown');
			setTimeout(function () {
				sendAllPostsToTelegram(i + 1);
			}, 1500);
			return;
		}
	}
	telegram_post(s, 'markdown');
}

tg.on('message', function (msg) {
	if (!msg.text) {
		return;
	}

	var chatId = msg.chat.id;
	var senderName = msg.from.first_name;
	if (!msg.text.indexOf('/parsavkstart')) {
		// if (tgChats.indexOf(chatId) === -1) {
		// tgChats.push(chatId);
		// writeTgChats();
		// tg.sendMessage(chatId, START_STR);
		// }
	} else if (!msg.text.indexOf('/parsavkstop')) {
		// var chatIndex = tgChats.indexOf(chatId);
		// if (chatIndex !== -1) {
		// tgChats.splice(chatIndex, 1);
		// writeTgChats();
		// tg.sendMessage(chatId, STOP_STR);
		// }
	} else if (!msg.text.indexOf('/showposts')) {
		sendAllPostsToTelegram(0);
	} else if (tgChats.indexOf(chatId) !== -1 && msg.text.includes('vk.com') && msg.text.includes('wall')) {
		var res = msg.text.split("wall");
		if (res[0] && res[1]) {
			var groupPostKey = res[res.length - 1];
			console.log(groupPostKey);
			if (groupPostKey) {
				var groupPostArray = parsePostKey(groupPostKey);
				if (!vkWallPosts.posts[groupPostKey]) {
					vkWallPosts.posts[groupPostKey] = {
						"count": -1
					};
					vkWallPosts.list[vkWallPosts.list.length] = groupPostKey;
					writeVkWallPosts();
					telegram_post(senderName + ", пост успешно добавлен в список", 'markdown');
				} else {
					telegram_post(senderName + ", этот пост уже добавлен", 'markdown');
				}
			}
		}
	}
});

var escapeMd = function (text) {
	text = text.toString();

	var specialChars = new RegExp('([\\\\`*_\\[]){1}', 'g');

	return text.replace(specialChars, function (match) {
		return '\\' + match;
	});
};

var telegram_post = function (msg, mode) {
	console.log('Sending to Telegram: ' + msg);

	tgChats.forEach(function (chatId) {
		tg.sendMessage(chatId, msg, {
			disable_web_page_preview: true,
			parse_mode: mode
		});
	});
};

function parsePostKey(groupPostKey) {
	var groupPostArray = groupPostKey.split("_");
	// console.log(groupPostArray);
	return groupPostArray;
}

setTimeout(parseTimer, 1000);

function cacheGroupName(what) {
	if (what.charAt(0) == "-") {
		var group = what.substring(1);
		request({
			url: 'https://api.vk.com/method/groups.getById?group_id=' + group + '&' + VK_STATIC_QUERY
		}, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				var bodyArray = JSON.parse(body);
				if (bodyArray && bodyArray.response && bodyArray.response[0] && bodyArray.response[0].name) {
					vkWallPosts.groupNameCache[what] = bodyArray.response[0].name;
					console.log("groups.getById: " + vkWallPosts.groupNameCache[what]);
					writeVkWallPosts();
				}
			}
		})
	} else {
		request({
			url: 'https://api.vk.com/method/users.get?user_ids=' + what + '&fields=screen_name&' + VK_STATIC_QUERY
		}, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				var bodyArray = JSON.parse(body);
				if (bodyArray && bodyArray.response && bodyArray.response[0] && bodyArray.response[0].first_name && bodyArray.response[0].last_name) {
					vkWallPosts.groupNameCache[what] = bodyArray.response[0].first_name + " " + bodyArray.response[0].last_name;
					console.log("users.get: " + vkWallPosts.groupNameCache[what]);
					writeVkWallPosts();
				}
			}
		})
	}

}

function parseTimer() {
	if (vkWallPosts.list.length == 0) {
		setTimeout(parseTimer, 1000);
		return;
	}
	var currentGroupPost = vkWallPosts.list[vkWallPosts.current];
	if (!currentGroupPost) {
		vkWallPosts.current = 0;
		setTimeout(parseTimer, 1000);
		return;
	}
	var currentGroupPostParsed = parsePostKey(currentGroupPost);
	if (currentGroupPostParsed[0]) {
		if (vkWallPosts.groupNameCache[currentGroupPostParsed[0]]) {
			var operandCount = 1;
			var operandExtended = 0;
			var operandThreadItems = 0;
			// if (!vkWallPosts.posts[currentGroupPost].ourComments) {
			operandCount = 100;
			operandExtended = 1;
			operandThreadItems = 10;
			// }
			request({
				url: 'https://api.vk.com/method/wall.getComments?owner_id=' + currentGroupPostParsed[0] + '&post_id=' + currentGroupPostParsed[1] + '&count=' + operandCount + '&extended=' + operandExtended + '&thread_items_count=' + operandThreadItems + '&' + VK_STATIC_QUERY
			}, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					var bodyArray = JSON.parse(body);
					// console.log("vk_getComments_callback: group " + currentGroupPostParsed[0] + ", post " + currentGroupPostParsed[1]);
					if (bodyArray && bodyArray.response) {
						if (operandExtended == 1) {
							if (!vkWallPosts.posts[currentGroupPost].ourComments) {
								vkWallPosts.posts[currentGroupPost].ourComments = {};
							}
							for (var i = 0; i < bodyArray.response.profiles.length; i++) {
								if (config.vk.profiles[bodyArray.response.profiles[i].id] && !vkWallPosts.posts[currentGroupPost].ourComments[bodyArray.response.profiles[i].id]) {
									vkWallPosts.posts[currentGroupPost].ourComments[bodyArray.response.profiles[i].id] = true;
									writeVkWallPosts();
								}
							}
						}
						if (bodyArray.response.count != vkWallPosts.posts[currentGroupPost].count) {
							var s = "";
							if (vkWallPosts.posts[currentGroupPost].count != -1 && vkWallPosts.posts[currentGroupPost].count < bodyArray.response.count) {
								s += "🔴🔴🔴 ";
							}
							s += "https://vk.com/wall";
							s += currentGroupPostParsed[0];
							s += "_";
							s += currentGroupPostParsed[1];
							s += " (";
							s += vkWallPosts.groupNameCache[currentGroupPostParsed[0]];
							s += ")\n\n";
							if (vkWallPosts.posts[currentGroupPost].count != -1) {
								if (vkWallPosts.posts[currentGroupPost].count < bodyArray.response.count) {
									s += "Появились новые комментарии (с " + vkWallPosts.posts[currentGroupPost].count + " до " + bodyArray.response.count + ")";
								} else {
									s += "Комментарии потёрли (с " + vkWallPosts.posts[currentGroupPost].count + " до " + bodyArray.response.count + ")";
								}
							} else {
								s += "Пост (комментов: " + bodyArray.response.count + ") активирован";
							}
							telegram_post(s, 'html');
							vkWallPosts.posts[currentGroupPost].count = bodyArray.response.count;
							writeVkWallPosts();
						}
					} else {
						// console.log("vk_getComments_callback error: group " + currentGroupPostParsed[0] + ", post " + currentGroupPostParsed[1] + ", " + body);
					}
				}
				if (operandExtended == 1) {
					setTimeout(parseTimer, 1000);
				} else {
					setTimeout(parseTimer, 400);
				}
			});
		} else {
			cacheGroupName(currentGroupPostParsed[0]);
			setTimeout(parseTimer, 400);
			return;
		}
	}
	vkWallPosts.current++;
	if (vkWallPosts.current >= vkWallPosts.list.length) {
		vkWallPosts.current = 0;
	}
}
