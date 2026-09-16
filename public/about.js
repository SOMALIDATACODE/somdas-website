if('IntersectionObserver' in window&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){entry.target.classList.add('about-enter');observer.unobserve(entry.target);}}},{threshold:.12});
 document.querySelectorAll('.about-intro-grid,.statement-grid,.difference-card,.about-person').forEach(el=>observer.observe(el));
}
