const pageStatus=document.querySelector('[data-page-status]');

async function profileApi(path,options={}){const response=await fetch(path,{...options,headers:{Accept:'application/json',...(options.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Something went wrong. Please try again.');return data;}
function formObject(form){return Object.fromEntries(new FormData(form).entries());}
function dialogStatus(dialog,message='',error=false){const node=dialog?.querySelector('[data-dialog-status]');if(node){node.textContent=message;node.dataset.error=String(error);}}
function openDialog(id){const dialog=document.getElementById(id);if(!dialog)return;dialogStatus(dialog);dialog.showModal();setTimeout(()=>dialog.querySelector('input,button:not([data-dialog-close])')?.focus(),30);}

document.querySelectorAll('[data-dialog-open]').forEach(button=>button.addEventListener('click',()=>openDialog(button.dataset.dialogOpen)));
document.querySelectorAll('[data-dialog-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog')?.close()));

document.querySelector('[data-profile-details]')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');button.disabled=true;pageStatus.textContent='Saving…';pageStatus.dataset.error='false';try{const data=await profileApi('/api/auth/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(formObject(form))});document.querySelectorAll('[data-profile-name]').forEach(node=>node.textContent=data.user.name);document.querySelectorAll('[data-profile-initials]').forEach(node=>node.textContent=data.user.name.split(/\s+/).map(x=>x[0]).filter(Boolean).filter((_x,i,a)=>i===0||i===a.length-1).join('').slice(0,2).toUpperCase());pageStatus.textContent='Profile updated.';}catch(error){pageStatus.textContent=error.message;pageStatus.dataset.error='true';}finally{button.disabled=false;}});

const photoDialog=document.querySelector('#profile-photo-dialog'),cropDialog=document.querySelector('#profile-crop-dialog'),cropStage=cropDialog?.querySelector('[data-crop-stage]'),cropImage=cropDialog?.querySelector('[data-crop-image]'),cropEmpty=cropDialog?.querySelector('[data-crop-empty]'),cropZoom=cropDialog?.querySelector('[data-crop-zoom]'),cropSave=cropDialog?.querySelector('[data-crop-save]');
let cropSource=null,cropScale=1,cropOffsetX=0,cropOffsetY=0,cropDragging=false,cropStartX=0,cropStartY=0,cropStartOffsetX=0,cropStartOffsetY=0;
function updateCrop(){if(!cropImage||!cropStage||!cropSource)return;const size=cropStage.clientWidth||280,base=Math.max(size/cropSource.width,size/cropSource.height),scale=base*Number(cropZoom?.value||1);cropScale=scale;const maxX=Math.max(0,(cropSource.width*scale-size)/2),maxY=Math.max(0,(cropSource.height*scale-size)/2);cropOffsetX=Math.max(-maxX,Math.min(maxX,cropOffsetX));cropOffsetY=Math.max(-maxY,Math.min(maxY,cropOffsetY));cropImage.style.width=`${cropSource.width*scale}px`;cropImage.style.height=`${cropSource.height*scale}px`;cropImage.style.transform=`translate(calc(-50% + ${cropOffsetX}px), calc(-50% + ${cropOffsetY}px))`;}
function loadCropFile(file){if(!file||!file.type.startsWith('image/'))return;if(file.size>5242880){dialogStatus(photoDialog,'Profile image must be 5 MB or smaller.',true);return;}const reader=new FileReader();reader.onload=()=>{const image=new Image();image.onload=()=>{cropSource=image;if(cropImage){cropImage.src=String(reader.result);cropImage.hidden=false;}if(cropEmpty)cropEmpty.hidden=true;if(cropSave)cropSave.disabled=false;cropOffsetX=0;cropOffsetY=0;if(cropZoom)cropZoom.value='1';photoDialog?.close();cropDialog?.showModal();updateCrop();};image.src=String(reader.result);};reader.readAsDataURL(file);}
photoDialog?.querySelector('[data-profile-camera]')?.addEventListener('change',event=>loadCropFile(event.currentTarget.files?.[0]));
photoDialog?.querySelector('[data-profile-upload]')?.addEventListener('change',event=>loadCropFile(event.currentTarget.files?.[0]));
cropZoom?.addEventListener('input',updateCrop);
cropStage?.addEventListener('pointerdown',event=>{if(!cropSource)return;cropDragging=true;cropStage.setPointerCapture(event.pointerId);cropStartX=event.clientX;cropStartY=event.clientY;cropStartOffsetX=cropOffsetX;cropStartOffsetY=cropOffsetY;});
cropStage?.addEventListener('pointermove',event=>{if(!cropDragging)return;cropOffsetX=cropStartOffsetX+event.clientX-cropStartX;cropOffsetY=cropStartOffsetY+event.clientY-cropStartY;updateCrop();});
cropStage?.addEventListener('pointerup',()=>{cropDragging=false;});
cropDialog?.querySelector('[data-crop-change]')?.addEventListener('click',()=>{cropDialog.close();photoDialog?.showModal();});
photoDialog?.querySelectorAll('input[type=file]').forEach(input=>input.addEventListener('click',()=>{input.value='';}));
cropSave?.addEventListener('click',async()=>{
 if(!cropSource||!cropStage||cropSave.disabled)return;
 cropSave.disabled=true;
 dialogStatus(cropDialog,'Saving your profile photo…');
 const size=512,stageSize=cropStage.clientWidth||280,canvas=document.createElement('canvas');
 canvas.width=size;canvas.height=size;
 const context=canvas.getContext('2d');
 if(!context){dialogStatus(cropDialog,'Your browser could not prepare the cropped image.',true);cropSave.disabled=false;return;}
 const sourceX=(cropSource.width*cropScale/2-cropOffsetX-stageSize/2)/cropScale,sourceY=(cropSource.height*cropScale/2-cropOffsetY-stageSize/2)/cropScale,sourceSize=stageSize/cropScale;
 context.drawImage(cropSource,sourceX,sourceY,sourceSize,sourceSize,0,0,size,size);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
 if(!blob){dialogStatus(cropDialog,'Your browser could not prepare the cropped image.',true);cropSave.disabled=false;return;}
 try{
  await profileApi('/api/auth/avatar',{method:'POST',headers:{'Content-Type':'image/png','x-filename':'profile-crop.png'},body:blob});
  dialogStatus(cropDialog,'Profile photo saved.');
  setTimeout(()=>location.reload(),450);
 }catch(error){
  dialogStatus(cropDialog,error.message,true);
  cropSave.disabled=false;
 }
});
document.querySelector('[data-confirm-remove]')?.addEventListener('click',async event=>{const button=event.currentTarget,dialog=button.closest('dialog');button.disabled=true;dialogStatus(dialog,'Removing…');try{await profileApi('/api/auth/avatar',{method:'DELETE'});location.reload();}catch(error){dialogStatus(dialog,error.message,true);button.disabled=false;}});

document.querySelector('[data-profile-password]')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,dialog=form.closest('dialog'),button=form.querySelector('[type="submit"]');button.disabled=true;dialogStatus(dialog,'Updating…');try{await profileApi('/api/auth/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(formObject(form))});form.reset();dialogStatus(dialog,'Password updated successfully.');}catch(error){dialogStatus(dialog,error.message,true);}finally{button.disabled=false;}});
document.querySelector('[data-profile-forgot]')?.addEventListener('click',event=>{event.currentTarget.closest('dialog')?.close();document.dispatchEvent(new Event('somdas:forgot-password'));});

document.querySelector('[data-confirm-signout]')?.addEventListener('click',async event=>{const button=event.currentTarget,dialog=button.closest('dialog');button.disabled=true;dialogStatus(dialog,'Signing out…');try{await profileApi('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});location.assign('/');}catch(error){dialogStatus(dialog,error.message,true);button.disabled=false;}});
document.querySelector('[data-profile-delete]')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,dialog=form.closest('dialog'),button=form.querySelector('[type="submit"]');button.disabled=true;dialogStatus(dialog,'Deleting account permanently…');try{await profileApi('/api/auth/account',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify(formObject(form))});location.assign('/');}catch(error){dialogStatus(dialog,error.message,true);button.disabled=false;}});
