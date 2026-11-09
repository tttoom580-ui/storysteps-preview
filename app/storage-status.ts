export function markLocalSaved(){try{localStorage.setItem('storysteps-last-auto-save',String(Date.now()));window.dispatchEvent(new Event('storysteps-local-saved'))}catch{}}
