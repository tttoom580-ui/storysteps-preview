const entries = new Map();
const requests = new Map();

export function expandedDefinition(word) {
  return entries.get(word.toLowerCase().replace(/[’‘]/g, "'"));
}

export function loadDefinitions(words) {
  const initials = [...new Set(words.map(word => word.toLowerCase()[0]).filter(letter => /^[a-z]$/.test(letter)))];
  return Promise.all(initials.map(initial => {
    if (!requests.has(initial)) {
      const url = new URL('./dictionary/' + initial + '.json', document.baseURI);
      const request = fetch(url).then(response => {
        if (!response.ok) throw new Error('詞庫暫時無法載入，請再點一次單字。');
        return response.json();
      }).then(data => {
        for (const [word, definition] of Object.entries(data)) entries.set(word, definition);
      }).catch(error => {
        requests.delete(initial);
        throw error;
      });
      requests.set(initial, request);
    }
    return requests.get(initial);
  }));
}
