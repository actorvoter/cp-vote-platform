export const handler = async (_req: Request) => {
  console.log('🚀 Hello Test 函数开始执行')
  return new Response('Hello from hello-test!', { status: 200 })
}