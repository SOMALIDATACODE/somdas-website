import Admin from './workspace';
export const dynamic='force-dynamic';
export const metadata={title:'SOMDAS Admin',robots:{index:false,follow:false}};
export default async function AdminPage(){
 return <Admin name="CMS user" email=""/>;
}
