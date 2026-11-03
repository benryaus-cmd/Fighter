type PrefixedElement=HTMLElement&{webkitRequestFullscreen?:()=>Promise<void>|void};
type PrefixedDocument=Document&{webkitFullscreenElement?:Element;webkitExitFullscreen?:()=>Promise<void>|void};
export function isGameFullscreen(){const doc=document as PrefixedDocument;return Boolean(doc.fullscreenElement||doc.webkitFullscreenElement);}
/** Must be invoked directly from a trusted tap/click; failure never blocks play. */
export async function enterGameFullscreen():Promise<boolean>{
 if(isGameFullscreen())return true;const root=document.documentElement as PrefixedElement;
 try{if(root.requestFullscreen)await root.requestFullscreen({navigationUI:'hide'});else if(root.webkitRequestFullscreen)await root.webkitRequestFullscreen();else return false;return isGameFullscreen();}catch{return false;}
}
export async function toggleGameFullscreen(){const doc=document as PrefixedDocument;try{if(doc.fullscreenElement)await doc.exitFullscreen();else if(doc.webkitFullscreenElement)await doc.webkitExitFullscreen?.();else await enterGameFullscreen();}catch{/* Browser controls remain usable. */}}
