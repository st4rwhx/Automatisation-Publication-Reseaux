import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'CEMATYS Auto Post AI - Agent',
  description: '',
};

export default async function Page() {
  return redirect('/agents/new');
}
