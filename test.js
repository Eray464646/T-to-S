const text = 'Hallo! Wie geht es dir? Mir geht es gut.\nUnd dir?';
const regex = /[\s\S]*?[.!?\n]+|[\s\S]+$/g;
let match;
while ((match = regex.exec(text)) !== null) {
    if (match[0].length === 0) break;
    console.log(JSON.stringify(match[0]), match.index, match.index + match[0].length);
}
