import { AppLayout } from "@/components/app-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function EvaluationPage() {
  return (
    <AppLayout userRole="governance">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">需求評估</h1>
          <p className="text-muted-foreground">評估需求的商業價值與技術複雜度</p>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="mb-4 text-lg text-muted-foreground">請從收件匣選擇需求開始評估</p>
            <Button asChild>
              <Link href="/governance/inbox">前往收件匣</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
