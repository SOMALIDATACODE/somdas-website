import {headers} from 'next/headers';
import {requireChatGPTUser} from '../chatgpt-auth';
import {isEditor} from '../../lib/content';
import Editor from './editor';
export const dynamic='force-dynamic';
export default async function EditorPage(){
 const user=await requireChatGPTUser('/editor');
 if(!isEditor(await headers()))return <main className="access-page"><h1>Owner access required</h1><p>This editor is reserved for the SOMDAS owner.</p><a href="/">Return to homepage</a></main>;
 return <Editor name={user.displayName}/>;
}
