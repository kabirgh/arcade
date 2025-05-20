import { memo } from "react";
import ReactMarkdown from "react-markdown";

const NonMemoizedMarkdown = ({ children }: { children: string }) => {
  const components = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    p: ({ children, ...props }: any) => {
      return (
        <p className="mb-[0.5rem] leading-relaxed" {...props}>
          {children}
        </p>
      );
    },
  };

  return <ReactMarkdown components={components}>{children}</ReactMarkdown>;
};

export const Markdown = memo(
  NonMemoizedMarkdown,
  (prevProps, nextProps) => prevProps.children === nextProps.children
);
