const fs = require("fs-extra");
const path = require("path");

const gclockDataPath = path.join(__dirname, "..", "..", "database", "gclock.json");

// Ensure data file exists
if (!fs.existsSync(gclockDataPath)) {
	fs.writeFileSync(gclockDataPath, JSON.stringify({}, null, 2));
}

module.exports = {
	config: {
		name: "gclock",
		version: "2.1",
		author: "Anurag",
		countDown: 5,
		role: 1,
		description: {
			vi: "Khóa tên nhóm - Silent Mode (không cho thay đổi tên nhóm)",
			en: "Lock group name - Silent Mode (prevent group name changes)"
		},
		category: "box chat",
		guide: {
			en: "   {pn} [group name] - Lock group name to specified name\n"
				+ "   {pn} - Unlock group name\n"
				+ "   {pn} status - Check lock status"
		}
	},

	langs: {
		vi: {
			noPermission: "Bạn không có quyền sử dụng lệnh này",
			noName: "Vui lòng nhập tên nhóm cần khóa",
			successLock: "🔒 Đã khóa tên nhóm thành: %1",
			successUnlock: "🔓 Đã mở khóa tên nhóm",
			statusLocked: "📋 Trạng thái: Tên nhóm đang bị khóa\n🔒 Tên đã khóa: %1",
			statusUnlocked: "📋 Trạng thái: Tên nhóm chưa bị khóa",
			failed: "❌ Không thể thực hiện, vui lòng thử lại sau",
			reverted: "⚠️ Tên nhóm bị khóa! Đã khôi phục về: %1"
		},
		en: {
			noPermission: "You don't have permission to use this command",
			noName: "Please enter the group name to lock",
			successLock: "🔒 Group name locked to: %1",
			successUnlock: "🔓 Group name unlocked",
			statusLocked: "📋 Status: Group name is locked\n🔒 Locked name: %1",
			statusUnlocked: "📋 Status: Group name is not locked",
			failed: "❌ Failed to perform action, please try again later",
			reverted: "⚠️ Group name is locked! Reverted to: %1"
		}
	},

	onStart: async function ({ message, event, args, threadsData, getLang }) {
		// Get API from global.GoatBot.fcaApi
		const api = global.GoatBot?.fcaApi;
		if (!api) {
			return message.reply("❌ API not available!");
		}

		const { threadID } = event;

		// Load gclock data
		let gclockData = {};
		try {
			gclockData = JSON.parse(fs.readFileSync(gclockDataPath, "utf8"));
		} catch (e) {
			gclockData = {};
		}

		// Handle status command
		if (args[0] === "status") {
			if (gclockData[threadID]) {
				return message.reply(getLang("statusLocked", gclockData[threadID].name));
			} else {
				return message.reply(getLang("statusUnlocked"));
			}
		}

		// If no args, unlock the group name (SILENT)
		if (args.length === 0) {
			if (gclockData[threadID]) {
				delete gclockData[threadID];
				fs.writeFileSync(gclockDataPath, JSON.stringify(gclockData, null, 2));
				// SILENT: No success message sent
				console.log(`[GCLOCK] Silent unlock for thread: ${threadID}`);
				return;
			} else {
				return message.reply("❌ Group name is not locked!\n💡 Usage: gclock [group name] to lock");
			}
		}

		// Get group name from args
		const groupName = args.join(" ");

		// Lock the group name with timestamp
		gclockData[threadID] = {
			name: groupName,
			lockedBy: event.senderID,
			lockedAt: Date.now()
		};
		fs.writeFileSync(gclockDataPath, JSON.stringify(gclockData, null, 2));

		// Set the group name immediately using gcname API
		try {
			await new Promise((resolve, reject) => {
				api.gcname(groupName, threadID, (err) => {
					if (err) reject(err);
					else resolve();
				});
			});

			// SILENT: No success message sent
			console.log(`[GCLOCK] Silent lock applied: ${groupName} | Thread: ${threadID}`);
			return;
		} catch (err) {
			console.error("Gclock error:", err);
			return message.reply(getLang("failed"));
		}
	},

	// Event handler to prevent group name changes (SILENT REVERT)
	onEvent: async function ({ event, message, getLang }) {
		const api = global.GoatBot?.fcaApi;
		if (!api) return;

		const { threadID, logMessageType, logMessageData, author } = event;

		// Check if it's a group name change event
		if (logMessageType !== "log:thread-name") return;

		// Load gclock data
		let gclockData = {};
		try {
			gclockData = JSON.parse(fs.readFileSync(gclockDataPath, "utf8"));
		} catch (e) {
			return;
		}

		// Check if this thread has a locked group name
		if (!gclockData[threadID]) return;

		const lockedName = gclockData[threadID].name;
		const newName = logMessageData.name;

		// If the new name is different from locked name
		if (newName !== lockedName) {
			// Revert to locked name using gcname API (SILENT)
			try {
				api.gcname(lockedName, threadID, (err) => {
					if (err) {
						console.error("Failed to revert group name:", err);
					} else {
						// SILENT: No warning message sent
						console.log(`[GCLOCK] Silent revert: ${threadID} -> ${lockedName}`);
					}
				});
			} catch (e) {
				console.error("Gclock event error:", e);
			}
		}
	}
};
