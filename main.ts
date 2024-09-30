import { Plugin, TFile, TAbstractFile, TFolder, EditorSuggest, Editor, EditorPosition, EditorSuggestTriggerInfo, EditorSuggestContext, Notice} from "obsidian";

let dictionary_terms: Array<string> = [];

const excluded_chars: Array<string> = [' ', '.', '!', '?', "#", "$", "@", "%", "^", "&", "*", "(", ")", "[", "]", "{", "}", ";", ":", "'", '"', ",", "/", "<", ">", "~", "`", "+"]

let dictionary_name: string = "Dictionary";

interface DictionaryDevSettings {
	something: string;
}

const DEFAULT_SETTINGS: DictionaryDevSettings = {
	something: "FooBar"
}

//Calculates the closeness of two given strings.
const levenshteinDistance = (first: string, second: string): number => {
	if (first.length === 0 || second.length === 0) {
		return Math.abs(first.length - second.length)
	}

	let levenshtein_matrix: number[][] = []

	//Increment the first column of each row
	let i: number = 0;

	for (i; i <= second.length; ++i) {
		levenshtein_matrix[i] = [i];
	}

	//Go through each column of first row
	let j: number = 0;

	for (j; j <= first.length; ++j) {
		levenshtein_matrix[0][j] = j
	}

	//Fill out rest of matrix
	for (i = 1; i <= second.length; ++i) {
		for (j = 1; j <= first.length; ++j) {
			if (second.at(i - 1) === first.at(j - 1)) {
				levenshtein_matrix[i][j] = levenshtein_matrix[i - 1][j - 1];
			}
			else {
				levenshtein_matrix[i][j] = Math.min(levenshtein_matrix[i - 1][j - 1] + 1, //Substitution of a char
					 								Math.min(levenshtein_matrix[i][j - 1] + 1, //Insertion of a char
						 							levenshtein_matrix[i-1][j] + 1))		// Deletion of a char
			}
		}
	}

	return levenshtein_matrix[second.length][first.length];
}

class DictionaryDevAutocomplete extends EditorSuggest<string> {
	limit: 4

	onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
		const line: string = editor.getLine(cursor.line);

		if (line.length <= 0) {
			return null;
		}

		const position: EditorPosition = editor.getCursor("from")

		if (excluded_chars.contains(line.at(position.ch - 1)!)) {
			return null;
		}

		let start_index: number = 0, end_index: number = line.length;

		for (let i = position.ch - 1; i >= 0; --i) {
			if (excluded_chars.contains(line.at(i)!)) {
				start_index = i + 1;
				break;
			}
		}

		for (let i = position.ch - 1; i < line.length; ++i) {
			if (excluded_chars.contains(line.at(i)!)) {
				end_index = i;
				break;
			}
		}

		if (end_index - start_index <= 1) {
			return null;
		}

		return {
			start: { line: cursor.line, ch: start_index },
			end: { line: cursor.line, ch: end_index },

			query: line.substring(start_index, end_index)
		};
	}

	getSuggestions(context: EditorSuggestContext): string[] | Promise<string[]> {
		return new Promise((resolve, reject) => {
			const query = context.query.toUpperCase();

			let regex = new RegExp(query);

			resolve(dictionary_terms.filter((term) => {
				if (term.toUpperCase().match(regex)) {
					return term;
				}
			}).sort((smaller, bigger) => {
				return levenshteinDistance(smaller.toUpperCase(), query) - levenshteinDistance(bigger.toUpperCase(), query);
			}))
		});
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.appendText(value)
	}

	selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
		const editor_position: EditorPosition = this.app.workspace.activeEditor?.editor?.getCursor("from")!;

		const line: string = this.app.workspace.activeEditor?.editor?.getLine(editor_position.line)!;

		let start_index: number = 0, end_index: number = line.length;

		for (let i = editor_position.ch - 1; i >= 0; --i) {
			if (excluded_chars.contains(line.at(i)!)) {
				start_index = i + 1;
				break;
			}
		}

		for (let j = editor_position.ch - 1; j < line.length; ++j) {
			if (excluded_chars.contains(line.at(j)!)) {
				end_index = j;
				break;
			}
		}

		const first_char: string = line.substring(start_index, end_index).at(0)!;

		if (first_char !== first_char.toUpperCase() && value.length > 1 && value.at(1) !== value.at(1)?.toUpperCase()) {
			value = value.toLowerCase();
		}

		this.app.workspace.activeEditor?.editor?.replaceRange(`[[${value}]]`, { line: editor_position.line, ch: start_index}, { line: editor_position.line, ch: end_index})
	}
}

class DictionaryDevDictAddition extends EditorSuggest<string> {
	limit: 5

	onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null): EditorSuggestTriggerInfo | null {
		const line: string = editor.getLine(cursor.line);

		if (line.length <= 6) {
			return null;
		}

		const open_tag_index: number = line.indexOf("!!!");

		const close_tag_index: number = line.indexOf("!!!", open_tag_index + 3);

		const definition_index: number = line.indexOf(": ", open_tag_index);

		if (close_tag_index - open_tag_index < 4 || open_tag_index === -1 || close_tag_index === -1 || definition_index - open_tag_index < 4 || close_tag_index - definition_index <= 0) {
			return null;
		}

		return {
			start: { line: cursor.line, ch: open_tag_index },
			end: { line: cursor.line, ch: close_tag_index },

			query: line.substring(open_tag_index + 3, close_tag_index)
		};
	}

	getSuggestions(context: EditorSuggestContext): string[] | Promise<string[]> {

		return new Promise((resolve, reject) => {
			resolve([context.query])
		});
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.appendText(`Create Term: ${value.substring(0, value.indexOf(": "))}`)
	}

	selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
		const file_path: string = this.app.workspace.activeEditor?.file!.path!.substring(0, this.app.workspace.activeEditor?.file!.path!.length - 3)!;

		new Notice(file_path);

		const name: string = value.substring(0, value.indexOf(": "));

		const description: string = value.substring(value.indexOf(": ") + 2);
		
		if (!this.app.vault.getFolderByPath(`${dictionary_name}/${file_path}`)) {
			this.app.vault.createFolder(`${dictionary_name}/${file_path}`);
		}

		this.app.vault.create(`${dictionary_name}/${file_path}/${name}.md`, description);

		const editor_position = this.app.workspace.activeEditor?.editor?.getCursor("from")!;

		const line: string = this.app.workspace.activeEditor?.editor?.getLine(editor_position.line)!;
		
		const open_tag_index: number = line.indexOf("!!!");

		const close_tag_index: number = line.indexOf("!!!", open_tag_index + 3);
		
		this.app.workspace.activeEditor?.editor?.replaceRange(`[[${name}]]`, { line: editor_position.line, ch: open_tag_index}, { line: editor_position.line, ch: close_tag_index + 3})
	}
}

export default class DictionaryDev extends Plugin {
	settings: DictionaryDevSettings

	async onload() {
		await this.loadSettings();

		let dictionary: TFolder | null = this.app.vault.getFolderByPath(dictionary_name);

		if (!dictionary) {
			this.app.vault.createFolder(dictionary_name)
		}

		dictionary = this.app.vault.getFolderByPath(dictionary_name);

		let terms: TAbstractFile[] = dictionary!.children

		for (let i: number = 0; i < terms.length; ++i) {
			const term: TAbstractFile = terms[i]

			if (term instanceof TFolder) {
				terms = terms.concat(term.children)
				continue;
			}

			dictionary_terms.push(term.name.substring(0, term.name.length - 3))
		}

		this.registerEditorSuggest(new DictionaryDevAutocomplete(this.app));

		this.registerEditorSuggest(new DictionaryDevDictAddition(this.app));

		this.registerEvent(this.app.vault.on("create", (file) => {
			if (file.path.includes(dictionary!.name) && !dictionary_terms.contains(file.name.substring(0, file.name.length - 3))) {
				dictionary_terms.push(file.name.substring(0, file.name.length - 3))
			}
		}));

		this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
			dictionary_terms.remove(oldPath.substring(oldPath.lastIndexOf("/") + 1, oldPath.length - 3))
			dictionary_terms.push(file.name.substring(0, file.name.length - 3))
		}));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
}