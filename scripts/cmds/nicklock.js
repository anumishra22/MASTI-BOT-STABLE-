module.exports = {
	config: {
		name: "nicklock",
		version: "3.1",
		author: "Anurag",
		countDown: 5,
		role: 1,
		description: {
			vi: "Khóa nickname tất cả thành viên trong nhóm (Silent Mode)",
			en: "Lock all members' nickname in the group (Silent Mode)"
		},
		category: "box chat",
		guide: {
			vi: "   {pn} on <nickname>: Khóa nickname tất cả thành viên thành tên chỉ định"
				+ "\n   {pn} off: Mở khóa nickname cho tất cả"
				+ "\n   {pn} list: Xem danh sách nickname đã khóa",
			en: "   {pn} on <nickname>: Lock everyone's nickname to specified name"
				+ "\n   {pn} off: Unlock all nicknames"
				+ "\n   {pn} list: View locked nicknames list"
		}
	},

	langs: {
		vi: {
			successLockAll: "✅ Đã khóa nickname tất cả thành viên thành: %1\n📊 Tổng số: %2 ngườI",
			successUnlockAll: "✅ Đã mở khóa nickname cho tất cả thành viên",
			listTitle: "📋 Danh sách nickname đã khóa:",
			listEmpty: "📋 Không có nickname nào đang bị khóa",
			listItem: "\n%1. %2: %3",
			needNickname: "⚠️ Vui lòng nhập nickname cần khóa\n💡 Ví dụ: nicklock on VIP Member",
			apiNotAvailable: "❌ API không khả dụng!",
			alreadyLocked: "⚠️ Nhóm đã có nickname bị khóa: %1\n💡 Dùng 'nicklock off' để mở khóa trước",
			reverted: "⚠️ Nickname của %1 bị khóa! Đã khôi phục về: %2",
			failed: "❌ Không thể đặt nickname cho %1"
		},
		en: {
			successLockAll: "✅ Locked everyone's nickname to: %1\n📊 Total: %2 members",
			successUnlockAll: "✅ Unlocked all nicknames",
			listTitle: "📋 Locked nicknames list:",
			listEmpty: "📋 No locked nicknames",
			listItem: "\n%1. %2: %3",
			needNickname: "⚠️ Please enter nickname to lock\n💡 Example: nicklock on VIP Member",
			apiNotAvailable: "❌ API not available!",
			alreadyLocked: "⚠️ Group already has locked nickname: %1\n💡 Use 'nicklock off' to unlock first",
			reverted: "⚠️ Nickname of %1 is locked! Reverted to: %2",
			failed: "❌ Failed to set nickname for %1"
		}
	},

	onStart: async function ({ message, event, args, threadsData, usersData, getLang }) {
		// Get API from global.GoatBot.fcaApi
		const api = global.GoatBot?.fcaApi;
		if (!api) {
			return message.reply(getLang("apiNotAvailable"));
		}

		const { threadID } = event;

		// List command
		if (args[0] === "list") {
			const nicklockData = await threadsData.get(threadID, "data.nicklock", {});
			const lockedUsers = Object.keys(nicklockData).filter(id => id !== "globalLock");

			if (lockedUsers.length === 0 || !nicklockData.globalLock) {
				return message.reply(getLang("listEmpty"));
			}

			let msg = getLang("listTitle") + `\n🔒 Global Lock: ${nicklockData.globalLock.nickname}`;
			let i = 1;
			for (const userID of lockedUsers) {
				const userData = await usersData.get(userID);
				const name = userData?.name || userID;
				msg += getLang("listItem", i++, name, nicklockData[userID].nickname);
			}
			return message.reply(msg);
		}

		// OFF command - Unlock all (SILENT - no message)
		if (args[0] === "off") {
			const nicklockData = await threadsData.get(threadID, "data.nicklock", {});
			
			if (!nicklockData.globalLock) {
				return message.reply(getLang("listEmpty"));
			}

			// Clear all locked nicknames
			await threadsData.set(threadID, {}, "data.nicklock");
			// SILENT: No success message sent
			return;
		}

		// ON command - Lock all with same nickname (SILENT - no message)
		if (args[0] === "on") {
			const nickname = args.slice(1).join(" ");
			
			if (!nickname) {
				return message.reply(getLang("needNickname"));
			}

			const nicklockData = await threadsData.get(threadID, "data.nicklock", {});
			
			// Check if already locked globally
			if (nicklockData.globalLock) {
				return message.reply(getLang("alreadyLocked", nicklockData.globalLock.nickname));
			}

			// Get thread info to get all members
			let threadInfo;
			try {
				threadInfo = await api.getThreadInfo(threadID);
			} catch (err) {
				console.error("Failed to get thread info:", err);
				return message.reply("❌ Failed to get group members!");
			}

			const participants = threadInfo.participantIDs || [];
			const botID = api.getCurrentUserID ? api.getCurrentUserID() : null;
			
			// Filter out bot from nickname change
			const membersToLock = participants.filter(id => id !== botID);

			// Save global lock data
			nicklockData.globalLock = {
				nickname: nickname,
				lockedBy: event.senderID,
				lockedAt: Date.now()
			};

			// Lock each member's nickname
			let successCount = 0;
			let failCount = 0;

			for (const userID of membersToLock) {
				// Store in database
				nicklockData[userID] = {
					nickname: nickname,
					lockedAt: Date.now()
				};

				// Apply nickname immediately
				try {
					if (api.changeNickname) {
						api.changeNickname(nickname, threadID, userID);
					} else if (api.setNickname) {
						api.setNickname(nickname, threadID, userID);
					}
					successCount++;
				} catch (err) {
					console.error(`Failed to set nickname for ${userID}:`, err);
					failCount++;
				}
			}

			// Save to database
			await threadsData.set(threadID, nicklockData, "data.nicklock");

			// SILENT: No success message sent
			console.log(`[NICKLOCK] Silent lock applied: ${nickname} | Success: ${successCount} | Failed: ${failCount}`);
			return;
		}

		// If no valid command
		return message.reply(
			"❌ Invalid command!\n\n" +
			"Usage:\n" +
			"• nicklock on <nickname> - Lock everyone's nickname\n" +
			"• nicklock off - Unlock all nicknames\n" +
			"• nicklock list - View locked list"
		);
	},

	onEvent: async function ({ message, event, threadsData, usersData, getLang }) {
		const api = global.GoatBot?.fcaApi;
		if (!api) return;

		const { threadID, logMessageType, logMessageData, author } = event;

		// Check if it's a nickname change event
		if (logMessageType !== "log:user-nickname") return;

		const nicklockData = await threadsData.get(threadID, "data.nicklock", {});
		
		// Check if global lock is enabled
		if (!nicklockData.globalLock) return;

		const { participant_id, nickname: newNickname } = logMessageData;
		const lockedNickname = nicklockData.globalLock.nickname;

		// Get bot's user ID
		let botID;
		try {
			botID = api.getCurrentUserID ? api.getCurrentUserID() : null;
		} catch (e) {
			botID = null;
		}

		// If bot changed it, update the stored data
		if (botID && author === botID) {
			if (nicklockData[participant_id]) {
				nicklockData[participant_id].nickname = newNickname;
				nicklockData[participant_id].lockedAt = Date.now();
				await threadsData.set(threadID, nicklockData, "data.nicklock");
			}
			return;
		}

		// If someone else changed it and it's different from locked name, revert (SILENT)
		if (newNickname !== lockedNickname) {
			// Small delay to ensure the change is processed
			setTimeout(() => {
				try {
					if (api.changeNickname) {
						api.changeNickname(lockedNickname, threadID, participant_id);
					} else if (api.setNickname) {
						api.setNickname(lockedNickname, threadID, participant_id);
					}

					// SILENT: No warning message sent
					console.log(`[NICKLOCK] Silent revert: ${participant_id} -> ${lockedNickname}`);
				} catch (err) {
					console.error("Nicklock revert error:", err);
				}
			}, 1500);
		}
	}
};
