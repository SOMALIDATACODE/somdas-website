const theme=document.querySelector('#activity-theme');
theme?.addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem('somdas-theme',next);}catch{}theme.setAttribute('aria-label',`Switch to ${next==='dark'?'light':'dark'} mode`);});
const galleryDialog=document.querySelector('.image-dialog');
document.querySelectorAll('.gallery-open').forEach(button=>button.addEventListener('click',()=>{galleryDialog.querySelector('img').src=button.dataset.image;galleryDialog.querySelector('img').alt=button.dataset.alt;galleryDialog.querySelector('p').textContent=button.dataset.alt;galleryDialog.showModal();}));
galleryDialog?.querySelector('.image-close').addEventListener('click',()=>galleryDialog.close());
