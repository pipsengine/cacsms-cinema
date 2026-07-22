import { redirect } from 'next/navigation';

export default function LegacyStoryboardsRedirect() {
  redirect('/storyboard/storyboard-editor');
}
