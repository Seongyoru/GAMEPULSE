import {
  ContentRoute,
  contentMetadata,
  contentStaticParams,
  type SlugParams,
} from '@/components/content/content-route';

export const revalidate = 300;

export function generateStaticParams() {
  return contentStaticParams('patches');
}

export function generateMetadata({ params }: { params: SlugParams }) {
  return contentMetadata('patches', params);
}

export default function PatchPage({ params }: { params: SlugParams }) {
  return <ContentRoute family="patches" params={params} />;
}
