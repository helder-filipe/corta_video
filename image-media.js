/* A decoded still canvas with a lightweight media clock, shared by timeline controls. */
function isImageFile(file) {
  return /^image\//i.test(file.type) || /\.(png|jpe?g|webp|avif|bmp|gif)$/i.test(file.name);
}
async function imageMedia(file) {
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error(`Não foi possível abrir a imagem «${file.name}». Experimenta PNG, JPEG ou WebP.`); }
  const surface=document.createElement('canvas');surface.width=bitmap.width;surface.height=bitmap.height;
  surface.getContext('2d').drawImage(bitmap,0,0);bitmap.close();
  let position=0,started=0,running=false;
  Object.defineProperties(surface,{
    currentTime:{get:()=>position+(running?(performance.now()-started)/1000:0),set:value=>{position=Math.max(0,Number(value)||0);started=performance.now();}},
    duration:{value:86400},readyState:{value:4},videoWidth:{value:surface.width},videoHeight:{value:surface.height},
    paused:{get:()=>!running},ended:{get:()=>false},isStillImage:{value:true}
  });
  surface.pause=()=>{position=surface.currentTime;running=false;};
  surface.play=async()=>{if(!running){started=performance.now();running=true;}};
  return {kind:'image',video:surface,file,url:URL.createObjectURL(file),name:file.name,start:0,end:5,volume:0,transition:'none',transitionDuration:.8};
}
