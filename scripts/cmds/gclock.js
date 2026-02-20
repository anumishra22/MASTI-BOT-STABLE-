module.exports = {
	config: {
		name: "gclock",
		version: "1.0",
		author: "Anurag",
		countDown: 5,
		role: 1,
		description: {
			vi: "Khóa tên nhóm, khi ai đó đổi sẽ tự động khôi phục",
			en: "Lock group name, auto revert when someone changes it"
		},
		category: "box chat",
		guide: {
			vi: "   {pn} on <name>: Bật khóa tên nhóm vớI tên chỉ định"
				+ "\n   {pn} off: Tắt khóa tên nhóm"
				+ "\n   {pn} status: Xem trạng tháI khóa tên nhóm",
			en: "   {pn} on <name>: Enable group name lock with specified name"
				+ "\n   {pn} off: Disable group name lock"
				+ "\n   {pn} status: View group name lock status"
		}
	},

	langs: {
		vi: {
			success: "✅ Đã khóa tên nhóm thành: %1",
			unlocked: "✅ Đã mở khóa tên nhóm",
			alreadyLocked: "⚠️ Tên nhóm đã được khóa thành: %1",
			notLocked: "⚠️ Tên nhóm chưa được khóa",
			statusOn: "📋 Trạng tháI: Tên nhóm đang bị khóa\n🔒 Tên: %1",
			statusOff: "📋 Trạng tháI: Tên nhóm không bị khóa",
			needName: "⚠️ Vui lòng nhập tên nhóm cần khóa"
		},
		en: {
			success: "✅ Group name locked to: %1",
			unlocked: "✅ Group name unlocked",
			alreadyLocked: "⚠️ Group name is already locked to: %1",
			notLocked: "⚠️ Group name is not locked",
			statusOn: "📋 Status: Group name is locked\n🔒 Name: %1",
			statusOff: "📋 Status: Group name is not locked",
			needName: "⚠️ Please enter group name to lock"
		}
	},

	onStart: async function ({ message, event, args, threadsData, getLang, api }) {
		const { threadID } = event;
		
		// Status command
		if (args[0] === "status") {
			const lockedName = await threadsData.get(threadID, "data.gclock", null);
			if (lockedName) {
				return message.reply(getLang("statusOn", lockedName));
			} else {
				return message.reply(getLang("statusOff"));
			}
		}
		
		// Off command
		if (args[0] === "off") {
			const lockedName = await threadsData.get(threadID, "data.gclock", null);
			if (!lockedName) {
				return message.reply(getLang("notLocked"));
			}
			await threadsData.set(threadID, null, "data.gclock");
			return message.reply(getLang("unlocked"));
		}
		
		// On command - need group name
		if (args[0] === "on") {
			const groupName = args.slice(1).join(" ").trim();
			if (!groupName) {
				return message.reply(getLang("needName"));
			}
			
			// Check if already locked
			const existingLock = await threadsData.get(threadID, "data.gclock", null);
			if (existingLock) {
				return message.reply(getLang("alreadyLocked", existingLock));
			}
			
			// Save locked name
			await threadsData.set(threadID, groupName, "data.gclock");
			
			// Apply the name immediately
			api.setTitle(groupName, threadID);
			
			return message.reply(getLang("success", groupName));
		}
		
		// Default: if no subcommand, treat as direct name lock
		const groupName = args.join(" ").trim();
		if (!groupName) {
			return message.SyntaxError();
		}
		
		// Check if already locked
		const existingLock = await threadsData.get(threadID, "data.gclock", null);
		if (existingLock) {
			return message.reply(getLang("alreadyLocked", existingLock));
		}
		
		// Save locked name
		await threadsData.set(threadID, groupName, "data.gclock");
		
		// Apply the name immediately
		api.setTitle(groupName, threadID);
		
		return message.reply(getLang("success", groupName));
	},

	onEvent: async function ({ message, event, threadsData, api, getLang }) {
		const { threadID, logMessageType, logMessageData, author } = event;
		
		if (logMessageType !== "log:thread-name") return;
		
		const lockedName = await threadsData.get(threadID, "data.gclock", null);
		
		// Check if group name is locked
		if (!lockedName) return;
		
		// If bot changed it, update the stored name
		if (api.getCurrentUserID() === author) {
			const newName = logMessageData.name;
			await threadsData.set(threadID, newName, "data.gclock");
			return;
		}
		
		// If someone else changed it, revert
		setTimeout(() => {
			api.setTitle(lockedName, threadID);
			message.reply(`⚠️ Group name is locked! Reverting to: ${lockedName}`);
		}, 1000);
	}
};
