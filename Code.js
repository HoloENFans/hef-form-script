/**
 * @OnlyCurrentDoc  Limits the script to only accessing the current form.
 */

const DIALOG_TITLE = 'HEFW - Hook state';
const SIDEBAR_TITLE = 'HEFW - Hook setup';
const API_URL = 'https://cms-dev.holoen.fans';
const PLACEHOLDER_IMAGE_ID = '62cd715239e933cc1c758ade';

/**
 * Adds a custom menu with items to show the sidebar and dialog.
 *
 * @param {Object} e The event parameter for a simple onOpen trigger.
 */
function onOpen(e) {
	FormApp.getUi()
		.createAddonMenu()
		.addItem('Setup', 'showSidebar')
		.addItem('Enable/disable', 'showDialog')
		.addToUi();
}

/**
 * Runs when the add-on is installed; calls onOpen() to ensure menu creation and
 * any other initializion work is done immediately.
 *
 * @param {Object} e The event parameter for a simple onInstall trigger.
 */
function onInstall(e) {
	onOpen(e);
}

/**
 * Opens a sidebar. The sidebar structure is described in the Sidebar.html
 * project file.
 */
function showSidebar() {
	const ui = HtmlService.createTemplateFromFile('views/Sidebar')
		.evaluate()
		.setTitle(SIDEBAR_TITLE)
		.setSandboxMode(HtmlService.SandboxMode.IFRAME);
	FormApp.getUi().showSidebar(ui);
}

/**
 * Saves the API key to the document properties
 *
 * @param {String} key The API key to save
 */
function setApiKey(key) {
	const documentProperties = PropertiesService.getDocumentProperties();
	documentProperties.setProperty('HEFW:API_KEY', key);
}

/**
 * Function to check if the saved API key is valid
 *
 * @returns {Boolean} True if API key is valid
 */
function checkApiKey() {
	const documentProperties = PropertiesService.getDocumentProperties();
	const apiKey = documentProperties.getProperty('HEFW:API_KEY');

	const response = UrlFetchApp.fetch(`${API_URL}/api/users/me`, {
		headers: {
			Authorization: `User API-Key ${apiKey}`,
		},
	});
	const body = JSON.parse(response.getContentText());

	return body.user !== null;
}

/**
 * Function that returns all possible projects
 *
 * @return {String[][]} List of Projects
 */
function getProjects() {
	const documentProperties = PropertiesService.getDocumentProperties();
	const apiKey = documentProperties.getProperty('HEFW:API_KEY');

	let moreProjects = true;
	let page = 1;
	const projectMap = [];

	async function fetchNextProjects() {
		// Fetch next page
		const projects = UrlFetchApp.fetch(
			`${API_URL}/api/projects?where[status][not_equals]=past&page=${page}&depth=0`,
			{
				headers: {
					Authorization: `User API-Key ${apiKey}`,
				},
			},
		);
		const body = JSON.parse(projects.getContentText());

		for (const project of body.docs) {
			projectMap.push([project.title, project.id]);
		}

		// Set variables for next fetch
		page += 1;
		moreProjects = body.hasNextPage;
	}

	while (moreProjects) {
		fetchNextProjects();
	}

	return projectMap;
}

/**
 * Saves the project id to the document properties
 *
 * @param {String} id The project to save
 */
function setProject(id) {
	const documentProperties = PropertiesService.getDocumentProperties();
	documentProperties.setProperty('HEFW:PROJECT_ID', id);
}

/** Get all possible fields
 *
 * @return {Object} An object containing all possible fields
 */
function getFields() {
	const form = FormApp.getActiveForm();

	const fields = {
		text: [],
		upload: [],
	};

	const textItems = [
		...form.getItems(FormApp.ItemType.TEXT),
		...form.getItems(FormApp.ItemType.PARAGRAPH_TEXT),
	];
	const uploadItems = form.getItems(FormApp.ItemType.FILE_UPLOAD);

	for (const item of textItems) {
		fields.text.push([item.getTitle(), item.getId()]);
	}

	for (const item of uploadItems) {
		fields.upload.push([item.getTitle(), item.getId()]);
	}

	return fields;
}

/**
 * Saves all the fields to the document properties
 *
 * @param {Object} data The selected fields
 */
function saveFields(data) {
	const documentProperties = PropertiesService.getDocumentProperties();

	documentProperties.setProperty(
		'HEFW:ENABLED',
		JSON.stringify(data.enabled),
	);
	documentProperties.setProperty(
		'HEFW:FIELDS',
		JSON.stringify(data.selected),
	);
}

/**
 * Get the set data
 *
 * @return {Object} All the set data
 */
function getData() {
	const documentProperties = PropertiesService.getDocumentProperties();

	const apiKey = documentProperties.getProperty('HEFW:API_KEY');
	const projectId = documentProperties.getProperty('HEFW:PROJECT_ID');
	const enabledFields = JSON.parse(
		documentProperties.getProperty('HEFW:ENABLED'),
	);
	const selectedFields = JSON.parse(
		documentProperties.getProperty('HEFW:FIELDS'),
	);

	return {
		apiKey: apiKey && apiKey.length > 1 ? '*****' : undefined,
		projectId,
		enabledFields,
		selectedFields,
	};
}

/**
 * Opens a dialog. The dialog structure is described in the Dialog.html
 * project file.
 */
function showDialog() {
	const ui = HtmlService.createTemplateFromFile('views/Dialog')
		.evaluate()
		.setWidth(800)
		.setHeight(600)
		.setSandboxMode(HtmlService.SandboxMode.IFRAME);
	FormApp.getUi().showModalDialog(ui, DIALOG_TITLE);
}

/**
 * Check all the fields
 *
 * @return {Boolean} If all field configuration is valid
 */
function checkFieldConfig() {
	const form = FormApp.getActiveForm();
	const documentProperties = PropertiesService.getDocumentProperties();

	const enabled = JSON.parse(documentProperties.getProperty('HEFW:ENABLED'));
	const selected = JSON.parse(documentProperties.getProperty('HEFW:FIELDS'));

	if (!enabled || !selected || !selected.author) return false;
	if (!enabled.messages && !enabled.images && !enabled.videos) return false;

	const items = [];

	items.push(form.getItemById(selected.author));

	if (enabled.messages) {
		for (const field of selected.message) {
			items.push(form.getItemById(field));
		}
	}

	if (enabled.authorIcon) items.push(form.getItemById(selected.authorIcon));
	if (enabled.images) items.push(form.getItemById(selected.image));
	if (enabled.videos) items.push(form.getItemById(selected.videoSrc));

	return !items.includes(null);
}

/**
 * Check if selected project is valid
 *
 * @return {Boolean} True if project is valid
 */
function checkProject() {
	const documentProperties = PropertiesService.getDocumentProperties();
	const apiKey = documentProperties.getProperty('HEFW:API_KEY');
	const projectId = documentProperties.getProperty('HEFW:PROJECT_ID');

	if (!apiKey || !projectId) return false;

	const projectRes = UrlFetchApp.fetch(
		`${API_URL}/api/projects/${projectId}?depth=0`,
		{
			headers: {
				Authorization: `User API-Key ${apiKey}`,
			},
			muteHttpExceptions: true,
		},
	);

	return projectRes.getResponseCode() === 200;
}

/**
 * Queries the form DocumentProperties to determine whether the formResponse
 * trigger is enabled or not.
 *
 * @return {Boolean} True if the form submit trigger is enabled; false
 *     otherwise.
 */
function getTriggerState() {
	// Retrieve and return the information requested by the dialog.
	const properties = PropertiesService.getDocumentProperties();
	return properties.getProperty('HEFW:TRIGGER_ID') != null;
}

/**
 * Turns the form submit trigger on or off based on the given argument.
 *
 * @param {Boolean} enableTrigger whether to turn on the form submit
 *     trigger or not
 */
function adjustFormSubmitTrigger(enableTrigger) {
	// Use data collected from dialog to manipulate form.

	// Determine existing state of trigger on the server.
	const form = FormApp.getActiveForm();
	const properties = PropertiesService.getDocumentProperties();
	const triggerId = properties.getProperty('HEFW:TRIGGER_ID');

	if (!enableTrigger && triggerId != null) {
		// Delete the existing trigger.
		const triggers = ScriptApp.getUserTriggers(form);
		for (let i = 0; i < triggers.length; i++) {
			if (triggers[i].getUniqueId() === triggerId) {
				ScriptApp.deleteTrigger(triggers[i]);
				break;
			}
		}
		properties.deleteProperty('HEFW:TRIGGER_ID');
	} else if (enableTrigger && triggerId == null) {
		// Create a new trigger.
		const trigger = ScriptApp.newTrigger('respondToFormSubmit')
			.forForm(form)
			.onFormSubmit()
			.create();
		properties.setProperty('HEFW:TRIGGER_ID', trigger.getUniqueId());
	}
}

/**
 * Responds to form submit events if a form summit trigger is enabled.
 * Collects some form information and sends it as an email to the form creator.
 *
 * @param {Object} e The event parameter created by a form
 *      submission; see
 *      https://developers.google.com/apps-script/understanding_events
 */
function respondToFormSubmit(e) {
	const form = FormApp.getActiveForm();
	const documentProperties = PropertiesService.getDocumentProperties();

	const enabledFields = JSON.parse(
		documentProperties.getProperty('HEFW:ENABLED'),
	);
	const selectedFields = JSON.parse(
		documentProperties.getProperty('HEFW:FIELDS'),
	);
	const apiKey = documentProperties.getProperty('HEFW:API_KEY');
	const projectId = documentProperties.getProperty('HEFW:PROJECT_ID');

	const { response } = e;
	const responseId = response.getId();

	const body = {
		project: projectId,
		author: '',
		srcIcon: undefined,
		type: undefined,
		message: undefined,
		media: undefined,
		url: undefined,
		draft: true,
	};

	if (enabledFields.authorIcon) {
		const item = form.getItemById(selectedFields.authorIcon);
		const itemResponse = response.getResponseForItem(item);

		if (itemResponse) {
			const responseValue = itemResponse.getResponse();

			if (responseValue && responseValue[0] && responseValue[0] !== '') {
				//! DISABLED BECAUSE GOOGLE LIMITS

				/* const file = DriveApp.getFileById(responseValue[0]);
			const boundary = 'X-HEFW-HOOK-BOUNDARY';

			const filename = file.getName();
			const extension =				filename.substring(
				filename.lastIndexOf('.') + 1,
				filename.length,
			) || filename;

			let data = '';

			data += `--${boundary}\r\n`;
			data += `Content-Disposition: form-data; name="file"; filename="${responseId}-icon.${extension}"\r\n`;
			data += `Content-Type: ${file.getMimeType()}\r\n\r\n`;
			const payload = Utilities.newBlob(data)
				.getBytes()
				.concat(file.getBlob().getBytes())
				.concat(Utilities.newBlob(`\r\n--${boundary}--`).getBytes());

			const res = UrlFetchApp.fetch(`${API_URL}/api/submission-media`, {
				method: 'POST',
				contentType: `multipart/form-data; boundary=${boundary}`,
				payload,
				headers: {
					Authorization: `User API-Key ${apiKey}`,
				},
			});
			const resBody = JSON.parse(res.getContentText());

			body.srcIcon = resBody.doc.id; */
				body.srcIcon = PLACEHOLDER_IMAGE_ID;
			}
		}
	}

	if (enabledFields.images) {
		const item = form.getItemById(selectedFields.image);
		const itemResponse = response.getResponseForItem(item);

		if (itemResponse) {
			const responseValue = itemResponse.getResponse();

			if (responseValue && responseValue[0] && responseValue[0] !== '') {
				//! DISABLED BECAUSE GOOGLE LIMITS

				/* const file = DriveApp.getFileById(responseValue[0]);
			const boundary = 'X-HEFW-HOOK-BOUNDARY';

			const filename = file.getName();
			const extension =				filename.substring(
				filename.lastIndexOf('.') + 1,
				filename.length,
			) || filename;

			let data = '';

			data += `--${boundary}\r\n`;
			data += `Content-Disposition: form-data; name="file"; filename="${responseId}-media.${extension}"\r\n`;
			data += `Content-Type: ${file.getMimeType()}\r\n\r\n`;
			const payload = Utilities.newBlob(data)
				.getBytes()
				.concat(file.getBlob().getBytes())
				.concat(Utilities.newBlob(`\r\n--${boundary}--`).getBytes());

			const res = UrlFetchApp.fetch(`${API_URL}/api/submission-media`, {
				method: 'post',
				contentType: `multipart/form-data; boundary=${boundary}`,
				payload,
				headers: {
					Authorization: `User API-Key ${apiKey}`,
				},
			});
			const resBody = JSON.parse(res.getContentText());

			body.media = resBody.doc.id;
			body.type = 'image'; */

				body.media = PLACEHOLDER_IMAGE_ID;
				body.type = 'image';
			}
		}
	}

	const authorItem = form.getItemById(selectedFields.author);
	const authorResponse = response.getResponseForItem(authorItem);
	const authorResponseValue = authorResponse && authorResponse.getResponse();
	body.author = authorResponseValue || 'SOMEHOW EMPTY (HOOK ERROR)';

	if (enabledFields.messages) {
		for (const field of selectedFields.message) {
			const item = form.getItemById(field);
			const itemResponse = response.getResponseForItem(item);

			if (itemResponse) {
				const responseValue = itemResponse.getResponse();

				if (responseValue && responseValue !== '') {
					body.message = responseValue;
					break;
				}
			}
		}
	}

	if (enabledFields.videos && body.type !== undefined) {
		const item = form.getItemById(selectedFields.videoSrc);
		const itemResponse = response.getResponseForItem(item);

		if (itemResponse) {
			const responseValue = itemResponse.getResponse();

			if (responseValue && responseValue !== '') {
				body.url = responseValue;
				body.type = 'video';
			}
		}
	}

	if (body.type === undefined) body.type = 'text';

	UrlFetchApp.fetch(`${API_URL}/api/submissions`, {
		method: 'post',
		contentType: 'application/json',
		payload: JSON.stringify(body),
		headers: {
			Authorization: `User API-Key ${apiKey}`,
		},
		muteHttpExceptions: true,
	});
}
