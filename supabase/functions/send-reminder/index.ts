export const handler = async (_req: Request) => {
  console.log('🚀 Hello World 函数开始执行')
  return new Response('Hello from send-reminder!', { status: 200 })
}