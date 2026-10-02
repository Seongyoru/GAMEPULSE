import {
  ContentRoute,
  contentMetadata,
  contentStaticParams,
  type SlugParams,
} from '@/components/content/content-route';

export const revalidate = 300;

export function generateStaticParams() {
  return contentStaticParams('events');
}

export function generateMetadata({ params }: { params: SlugParams }) {
  return contentMetadata('events', params);
}

export default function EventPage({ params }: { params: SlugParams }) {
  return <ContentRoute family="events" params={params} />;
}
