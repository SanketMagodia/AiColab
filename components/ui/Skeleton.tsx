export default function Skeleton({ height = 40, width = "100%" }: { height?: number; width?: string | number }) {
  return <div className="skel" style={{ height, width }} />;
}
