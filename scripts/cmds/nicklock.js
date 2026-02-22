module.exports = {
	config: {
		name: "nicklock",
		version: "7.0-ONE",
		author: "Anurag",
		countDown: 5,
		role: 1,
		description: {
			vi: "Khóa nickname 1 lần - Tự động revert",
			en: "One-shot lock - Auto revert"
		},
		category: "box chat",
		guide: {
			vi: "   {pn} <nickname>: Khóa tất cả + tự động revert",
			en: "   {pn} <nickname>: Lock all + auto revert"
		}
	},

	langs: {
		en: {
			locked: "🔒 Locked %1 members to: %2",
			unlocked: "🔓 Unlocked all",
			noLock: "❌ No active lock",
			reverted: "🔄 Reverted %1"
		}
	},

	// Store locks
	locks: new Map(),

	onStart: async function ({ message, event, args, threadsData, api, getLang }) {
		const { threadID } = event;
		const self = this;

		// If no args, show status
		if (!args[0]) {
			const lock = self.locks.get(threadID) || await threadsData.get(threadID, "nicklock", null);
			if (!lock) return message.reply("❌ Usage: nicklock <nickname>\n🔓 Or: nicklock off");
			return message.reply(`🔒 Active: ${lock.nickname} (${Object.keys(lock.members).length} members)`);
		}

		// OFF command
		if (args[0] === "off") {
			self.locks.delete(threadID);
			await threadsData.set(threadID, null, "nicklock");
			return message.reply("🔓 Unlocked all");
		}

		// ON command - One shot lock
		const nickname = args.join(" ").trim();
		
		try {
			const info = await api.getThreadInfo(threadID);
			const botID = api.getCurrentUserID?.();
			const members = (info.participantIDs || []).filter(id => id !== botID);

			// Save lock first
			const lockData = {
				nickname: nickname,
				members: {},
				startedAt: Date.now()
			};

			// Fast batch processing (500ms gap)
			let changed = 0;
			for (let i = 0; i < members.length; i++) {
				const userID = members[i];
				try {
					await api.changeNickname(nickname, threadID, userID);
					lockData.members[userID] = true;
					changed++;
				} catch (e) {
					// Skip failed
				}
				
				// Small delay every 3 members
				if ((i + 1) % 3 === 0) await new Promise(r => setTimeout(r, 500));
			}

			// Save to memory and DB
			self.locks.set(threadID, lockData);
			await threadsData.set(threadID, lockData, "nicklock");

			return message.reply(`🔒 Locked ${changed} members to: ${nickname}`);

		} catch (err) {
			return message.reply("❌ Failed: " + err.message);
		}
	},

	// Auto revert on change
	onEvent: async function ({ event, api, threadsData }) {
		const self = this;
		const { threadID, logMessageType, logMessageData, author } = event;

		if (logMessageType !== "log:user-nickname") return;

		// Get lock data
		let lock = self.locks.get(threadID);
		if (!lock) {
			lock = await threadsData.get(threadID, "nicklock", null);
			if (!lock) return;
			self.locks.set(threadID, lock);
		}

		const { participant_id, nickname: newNick } = logMessageData;
		const botID = api.getCurrentUserID?.();

		// Skip bot changes
		if (author === botID) return;

		// If changed to something else, revert silently
		if (newNick !== lock.nickname && lock.members[participant_id]) {
			setTimeout(() => {
				api.changeNickname(lock.nickname, threadID, participant_id).catch(() => {});
			}, 1000); // 1 second delay
		}
	}
};
