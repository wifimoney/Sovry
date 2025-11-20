'use client'

import { useState } from 'react'
import { RedisService } from '@/services/redisService'

export default function TestRedisPage() {
  const [testResult, setTestResult] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const testRedisConnection = async () => {
    setIsLoading(true)
    setTestResult('Testing Redis connection...')
    
    try {
      // Check config first
      const configValid = RedisService.isConfigValid()
      if (!configValid) {
        setTestResult('❌ Redis configuration is invalid. Check environment variables.')
        return
      }

      // Test connection
      const connectionTest = await RedisService.testConnection()
      if (connectionTest) {
        setTestResult('✅ Redis connection successful!')
      } else {
        setTestResult('❌ Redis connection failed. Check URL and token.')
      }
    } catch (error) {
      console.error('Redis test error:', error)
      setTestResult(`❌ Redis test error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Redis Connection Test</h1>
      
      <div className="space-y-4">
        <button
          onClick={testRedisConnection}
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          {isLoading ? 'Testing...' : 'Test Redis Connection'}
        </button>
        
        {testResult && (
          <div className="p-4 border rounded-lg bg-gray-50">
            <pre className="whitespace-pre-wrap">{testResult}</pre>
          </div>
        )}
        
        <div className="mt-8 p-4 border rounded-lg bg-yellow-50">
          <h2 className="font-bold mb-2">Environment Variables Check:</h2>
          <p>UPSTASH_REDIS_REST_URL: {process.env.UPSTASH_REDIS_REST_URL ? '✅ Set' : '❌ Missing'}</p>
          <p>UPSTASH_REDIS_REST_TOKEN: {process.env.UPSTASH_REDIS_REST_TOKEN ? '✅ Set' : '❌ Missing'}</p>
        </div>
      </div>
    </div>
  )
}
