'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'

export default function TestEnvPage() {
  const envVars = [
    {
      name: 'NEXT_PUBLIC_GOLDSKY_API_URL',
      value: process.env.NEXT_PUBLIC_GOLDSKY_API_URL,
      required: true,
      description: 'Goldsky subgraph endpoint for pool data'
    },
    {
      name: 'NEXT_PUBLIC_API_URL',
      value: process.env.NEXT_PUBLIC_API_URL,
      required: true,
      description: 'Backend API URL for pricing data'
    },
    {
      name: 'NEXT_PUBLIC_STORY_RPC_URL',
      value: process.env.NEXT_PUBLIC_STORY_RPC_URL,
      required: true,
      description: 'Story Protocol RPC endpoint'
    },
    {
      name: 'NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID',
      value: process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID,
      required: true,
      description: 'Dynamic.xyz environment ID for wallet connection'
    },
    {
      name: 'NEXT_PUBLIC_ROUTER_ADDRESS',
      value: process.env.NEXT_PUBLIC_ROUTER_ADDRESS,
      required: true,
      description: 'Sovry DEX router contract address'
    },
    {
      name: 'UPSTASH_REDIS_REST_URL',
      value: process.env.UPSTASH_REDIS_REST_URL,
      required: false,
      description: 'Upstash Redis URL (server-side only)'
    }
  ]

  const getStatusIcon = (value: string | undefined, required: boolean) => {
    if (value) {
      return <CheckCircle className="h-5 w-5 text-green-500" />
    } else if (required) {
      return <XCircle className="h-5 w-5 text-red-500" />
    } else {
      return <AlertCircle className="h-5 w-5 text-yellow-500" />
    }
  }

  const getStatusBadge = (value: string | undefined, required: boolean) => {
    if (value) {
      return <Badge variant="default" className="bg-green-500">✓ Set</Badge>
    } else if (required) {
      return <Badge variant="destructive">✗ Missing</Badge>
    } else {
      return <Badge variant="secondary">Optional</Badge>
    }
  }

  const requiredCount = envVars.filter(env => env.required).length
  const setRequiredCount = envVars.filter(env => env.required && env.value).length

  return (
    <div className="container mx-auto p-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-4">Environment Variables Test</h1>
        <p className="text-gray-600 mb-4">
          Verify that all required environment variables are properly configured
        </p>
        
        <div className="flex justify-center gap-4">
          <Badge variant={setRequiredCount === requiredCount ? "default" : "destructive"} className="text-lg px-4 py-2">
            {setRequiredCount}/{requiredCount} Required Variables Set
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 max-w-4xl mx-auto">
        {envVars.map((env) => (
          <Card key={env.name} className={`${env.required && !env.value ? 'border-red-200 bg-red-50' : ''}`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(env.value, env.required)}
                  <span className="font-mono text-sm">{env.name}</span>
                </div>
                {getStatusBadge(env.value, env.required)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-2">{env.description}</p>
              <div className="bg-gray-100 p-3 rounded-md">
                <code className="text-sm break-all">
                  {env.value ? (
                    env.value.length > 100 ? 
                      `${env.value.substring(0, 100)}...` : 
                      env.value
                  ) : (
                    <span className="text-red-500">Not set</span>
                  )}
                </code>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-4xl mx-auto">
        <h3 className="font-semibold text-blue-800 mb-2">Important Notes:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Environment variables prefixed with <code>NEXT_PUBLIC_</code> are accessible in the browser</li>
          <li>• Variables without this prefix are only available server-side</li>
          <li>• Restart the development server after changing environment variables</li>
          <li>• Check the <code>.env</code> file in the frontend directory for configuration</li>
        </ul>
      </div>
    </div>
  )
}
