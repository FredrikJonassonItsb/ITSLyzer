import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Handle queryKey properly - first element is the URL, second might be params or path segment
    let url = queryKey[0] as string;
    
    // Handle additional segments
    if (queryKey.length > 1) {
      const secondElement = queryKey[1];
      
      // If second element is an object, treat as query parameters
      if (typeof secondElement === 'object' && secondElement !== null) {
        const params = new URLSearchParams();
        const filters = secondElement as Record<string, any>;
        
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '' && value !== false) {
            if (Array.isArray(value) && value.length > 0) {
              // Use repeated keys for arrays instead of JSON stringify
              value.forEach(item => params.append(key, String(item)));
            } else if (!Array.isArray(value)) {
              params.append(key, String(value));
            }
          }
        });
        
        if (params.toString()) {
          url += '?' + params.toString();
        }
      } else {
        // If second element is not an object, treat as path segment
        url += '/' + String(secondElement);
        
        // Handle third element as query params if it exists and is an object
        if (queryKey.length > 2 && typeof queryKey[2] === 'object' && queryKey[2] !== null) {
          const params = new URLSearchParams();
          const filters = queryKey[2] as Record<string, any>;
          
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '' && value !== false) {
              if (Array.isArray(value) && value.length > 0) {
                value.forEach(item => params.append(key, String(item)));
              } else if (!Array.isArray(value)) {
                params.append(key, String(value));
              }
            }
          });
          
          if (params.toString()) {
            url += '?' + params.toString();
          }
        }
      }
    }

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
