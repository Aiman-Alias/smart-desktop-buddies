import { NextResponse, NextRequest } from 'next/server'

// Add paths that don't require authentication
const publicPaths = ['/', '/register', '/forgot-password', '/reset-password', '/verify-email']

export function middleware(request: NextRequest) {
  console.log('=== Middleware Debug ===')
  console.log('Request path:', request.nextUrl.pathname)
  console.log('Request method:', request.method)
  
  // Get token from cookies
  const token = request.cookies.get('token')?.value
  const refreshToken = request.cookies.get('refreshToken')?.value
  
  console.log('Cookie values:')
  console.log('- Token exists:', !!token)
  console.log('- Refresh token exists:', !!refreshToken)
  
  // Always allow access to '/' (login/landing page)
  if (request.nextUrl.pathname === '/') {
    console.log('Allowing access to root path / (login page)')
    return NextResponse.next()
  }

  // Allow access to other public paths
  if (publicPaths.includes(request.nextUrl.pathname)) {
    console.log('Allowing access to public path:', request.nextUrl.pathname)
    return NextResponse.next()
  }

  // Redirect to '/' if no token
  if (!token && !refreshToken) {
    console.log('No tokens found, redirecting to /')
    const loginUrl = new URL('/', request.url)
    loginUrl.searchParams.set('from', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Clone the request headers and add the Authorization header
  const requestHeaders = new Headers(request.headers)
  if (token) {
    requestHeaders.set('Authorization', `Bearer ${token}`)
    console.log('Adding Authorization header with token')
  }
  
  console.log('Final request headers:', Object.fromEntries(requestHeaders.entries()))
  console.log('=== End Middleware Debug ===')

  // Return the response with the modified headers
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
} 