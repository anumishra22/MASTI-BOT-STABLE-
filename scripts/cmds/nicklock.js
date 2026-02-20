module.exports = {
	config: {
		name: "nicklock",
		version: "2.0",
		author: "Anurag",
		countDown: 5,
		role: 1,
		description: {
			vi: "Khóa nickname của thành viên, khi ai đó đổi sẽ tự động khôi phục",
			en: "Lock a user's nickname, auto revert when someone changes it"
		},
		category: "box chat",
		guide: {
			vi: "   {pn} @tag <nickname>: Khóa nickname cho ngườI được tag"
				+ "\n   {pn} @tag off: Tắt khóa nickname cho ngườI được tag"
				+ "\n   {pn} list: Xem danh sách nickname đã khóa",
			en: "   {pn} @tag <nickname>: Lock nickname for tagged user"
				+ "\n   {pn} @tag off: Unlock nickname for tagged user"
				+ "\n   {pn} list: View locked nicknames list"
		}
	},

	langs: {
		vi: {
			success: "✅ Đã khóa nickname của %1 thành: %2",
			unlocked: "✅ Đã mở khóa nickname của %1",
			alreadyLocked: "⚠️ %1 đã có nickname bị khóa: %2",
			notLocked: "⚠️ %1 không có nickname bị khóa",
			listTitle: "📋 Danh sách nickname đã khóa:",
			listEmpty: "📋 Không có nickname nào đang bị khóa",
			listItem: "\n%1. %2: %3",
			needTag: "⚠️ Vui lòng tag ngườI dùng cần khóa nickname",
			needNickname: "⚠️ Vui lòng nhập nickname cần khóa",
			reverted: "⚠️ Nickname của %1 bị khóa! Đã khôi phục về: %2",
			apiNotAvailable: "❌ API không khả dụng!"
		},
		en: {
			success: "✅ Nickname locked for %1 to: %2",
			unlocked: "✅ Unlocked nickname for %1",
			alreadyLocked: "⚠️ %1 already has locked nickname: %2",
			notLocked: "⚠️ %1 doesn't have locked nickname",
			listTitle: "📋 Locked nicknames list:",
			listEmpty: "📋 No locked nicknames",
			listItem: "\n%1. %2: %3",
			needTag: "⚠️ Please tag the user to lock nickname",
			needNickname: "⚠️ Please enter nickname to lock",
			reverted: "⚠️ Nickname of %1 is locked! Reverted to: %2",
			apiNotAvailable: "❌ API not available!"
		}
	},

	onStart: async function ({ message, event, args, threadsData, usersData, getLang }) {
		// Get API from global.GoatBot.fcaApi
		const api = global.GoatBot?.fcaApi;
		if (!api) {
			return message.reply(getLang("apiNotAvailable"));
		}

		const { threadID, mentions, messageReply } = event;

		// List command
		if (args[0] === "list") {
			const nicklockData = await threadsData.get(threadID, "data.nicklock", {});
			const lockedUsers = Object.keys(nicklockData);

			if (lockedUsers.length === 0) {
				return message.reply(getLang("listEmpty"));
			}

			let msg = getLang("listTitle");
			let i = 1;
			for (const userID of lockedUsers) {
				const userData = await usersData.get(userID);
				const name = userData?.name || userID;
				msg += getLang("listItem", i++, name, nicklockData[userID].nickname);
			}
			return message.reply(msg);
		}

		// Get target user ID
		let targetID = null;
		if (Object.keys(mentions).length > 0) {
			targetID = Object.keys(mentions)[0];
		} else if (messageReply) {
			targetID = messageReply.senderID;
		}

		if (!targetID) {
			return message.reply(getLang("needTag"));
		}

		const userData = await usersData.get(targetID);
		const targetName = userData?.name || targetID;

		// Get current nicklock data
		const nicklockData = await threadsData.get(threadID, "data.nicklock", {});

		// Unlock command
		if (args[1] === "off") {
			if (!nicklockData[targetID]) {
				return message.reply(getLang("notLocked", targetName));
			}
			delete nicklockData[targetID];
			await threadsData.set(threadID, nicklockData, "data.nicklock");
			return message.reply(getLang("unlocked", targetName));
		}

		// Get nickname to lock
		let nickname = args.slice(1).join(" ");
		if (!nickname) {
			return message.reply(getLang("needNickname"));
		}

		// Remove mention from nickname if present
		if (mentions[targetID]) {
			nickname = nickname.replace(mentions[targetID], "").trim();
		}

		if (!nickname) {
			return message.reply(getLang("needNickname"));
		}

		// Check if already locked
		if (nicklockData[targetID]) {
			return message.reply(getLang("alreadyLocked", targetName, nicklockData[targetID].nickname));
		}

		// Save locked nickname with metadata
		nicklockData[targetID] = {
			nickname: nickname,
			lockedBy: event.senderID,
			lockedAt: Date.now()
		};
		await threadsData.set(threadID, nicklockData, "data.nicklock");

		// Apply the nickname immediately using the correct API
		try {
			// Try changeNickname first, then setNickname as fallback
			if (api.changeNickname) {
				api.changeNickname(nickname, threadID, targetID);
			} else if (api.setNickname) {
				await new Promise((resolve, reject) => {
					api.setNickname(nickname, threadID, targetID, (err) => {
						if (err) reject(err);
						else resolve();
					});
				});
			} else {
				return message.reply("❌ Nickname API not found in FCA!");
			}

			return message.reply(getLang("success", targetName, nickname));
		} catch (err) {
			console.error("Nicklock error:", err);
			// Remove from lock if failed
			delete nicklockData[targetID];
			await threadsData.set(threadID, nicklockData, "data.nicklock");
			return message.reply("❌ Failed to set nickname: " + err.message);
		}
	},

	onEvent: async function ({ message, event, threadsData, usersData, getLang }) {
		const api = global.GoatBot?.fcaApi;
		if (!api) return;

		const { threadID, logMessageType, logMessageData, author } = event;

		// Check if it's a nickname change event
		if (logMessageType !== "log:user-nickname") return;

		const nicklockData = await threadsData.get(threadID, "data.nicklock", {});
		const { participant_id, nickname: newNickname } = logMessageData;

		// Check if this user has locked nickname
		if (!nicklockData[participant_id]) return;

		const lockedNickname = nicklockData[participant_id].nickname;

		// Get bot's user ID
		let botID;
		try {
			botID = api.getCurrentUserID ? api.getCurrentUserID() : null;
		} catch (e) {
			botID = null;
		}

		// If bot changed it, update the stored nickname
		if (botID && author === botID) {
			nicklockData[participant_id].nickname = newNickname;
			nicklockData[participant_id].lockedAt = Date.now();
			await threadsData.set(threadID, nicklockData, "data.nicklock");
			return;
		}

		// If someone else changed it and it's different from locked name, revert
		if (newNickname !== lockedNickname) {
			const userData = await usersData.get(participant_id);
			const name = userData?.name || participant_id;

			// Small delay to ensure the change is processed
			setTimeout(() => {
				try {
					if (api.changeNickname) {
						api.changeNickname(lockedNickname, threadID, participant_id);
					} else if (api.setNickname) {
						api.setNickname(lockedNickname, threadID, participant_id);
					}

					// Send warning message
					if (message && message.reply) {
						message.reply(getLang("reverted", name, lockedNickname));
					}
				} catch (err) {
					console.error("Nicklock revert error:", err);
				}
			}, 1500);
		}
	}
};
