import { createClient } from '@/lib/supabase/server'

export default async function DebugSessionPage() {
	const supabase = createClient()
	const { data: { session } } = await supabase.auth.getSession()

	return (
		<div className="p-8">
			<h1 className="text-2xl font-bold mb-4">Debug de Sesión</h1>
			<pre className="bg-gray-100 p-4 rounded overflow-auto">
				{JSON.stringify({
					email: session?.user?.email,
					user_metadata: session?.user?.user_metadata,
					id: session?.user?.id,
					role: session?.user?.role
				}, null, 2)}
			</pre>
		</div>
	)
}