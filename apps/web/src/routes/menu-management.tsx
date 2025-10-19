import { useMutation, useQuery } from "@tanstack/react-query"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { Plus, RefreshCw } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { CategoryManager } from "@/components/category-manager"
import { DishEditor } from "@/components/dish-editor"
import { ModifierGroupEditor } from "@/components/modifier-group-editor"
import { ModifierManager } from "@/components/modifier-manager"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { authClient } from "@/lib/auth-client"
import { queryClient, trpc, trpcClient } from "@/utils/trpc"

/**
 * T129: Menu Management Route
 * Manager-only route for creating, editing, and managing dishes
 *
 * Auth Guard: Manager-only access
 * Reference: research.md Section 5 Access Control Matrix
 */

export const Route = createFileRoute("/menu-management")({
  component: RouteComponent,
  beforeLoad: async () => {
    const session = await authClient.getSession()

    // Check if user is authenticated
    if (!session.data) {
      throw redirect({
        to: "/login",
      })
    }

    // Note: Role checking commented out for MVP - will be enabled when user.role is available
    // Check if user has Manager role
    // const userRole = (session.data.user as any).role;
    // if (userRole !== "Manager") {
    // 	throw redirect({
    // 		to: "/dashboard",
    // 	});
    // }

    return { session }
  },
})

interface Dish {
  id: number
  name: string
  description: string
  price: number
  photoUrl: string | null
  isAvailable: boolean
  createdAt: Date
}

function RouteComponent() {
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingDish, setEditingDish] = useState<any | null>(null)

  // Query all dishes including disabled ones
  const {
    data: dishesData,
    isLoading,
    refetch,
  } = useQuery({
    ...trpc.dishes.getAll.queryOptions({
      includeDisabled: true,
    }),
  })

  // Mutation for toggling availability
  const toggleAvailability = useMutation({
    mutationFn: (variables: { dishId: number; isAvailable: boolean }) =>
      trpcClient.dishes.toggleAvailability.mutate(variables),
    onSuccess: () => {
      toast.success("Dish availability updated")
      refetch()
    },
    onError: (error: Error) => {
      toast.error(`Failed to update availability: ${error.message}`)
    },
  })

  const handleCreateNew = () => {
    setEditingDish(null)
    setIsEditorOpen(true)
  }

  const handleEdit = (dish: any) => {
    setEditingDish(dish)
    setIsEditorOpen(true)
  }

  const handleEditorClose = (success: boolean) => {
    setIsEditorOpen(false)
    setEditingDish(null)
    if (success) {
      refetch()
    }
  }

  const handleToggleAvailability = async (dishId: number, currentStatus: boolean) => {
    try {
      await toggleAvailability.mutateAsync({
        dishId,
        isAvailable: !currentStatus,
      })
    } catch (error) {
      // Error handled by mutation
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  const dishes = dishesData?.dishes || []

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Menu Management</h1>
          <p className="text-muted-foreground mt-2">Manage dishes, recipes, modifiers, and categories</p>
        </div>
      </div>

      {/* Dish Editor Modal */}
      {isEditorOpen && <DishEditor dish={editingDish} onClose={handleEditorClose} />}

      <Tabs defaultValue="dishes" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="dishes">Dishes</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="modifiers">Modifiers</TabsTrigger>
        </TabsList>

        <TabsContent value="dishes">
          <div className="flex justify-end gap-2 mb-4">
            <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Add Dish
            </Button>
          </div>

          {/* Dishes Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {dishes.map((dish: any) => (
          <Card key={dish.id} className={!dish.isAvailable ? "opacity-60" : ""}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{dish.name}</CardTitle>
                    {/* T060: Flag Badges */}
                    {dish.isRecommended && (
                      <span className="text-lg" title="Recommended">
                        👍
                      </span>
                    )}
                    {dish.isChefSpecial && (
                      <span className="text-lg" title="Chef's Special">
                        ⭐
                      </span>
                    )}
                    {dish.orderPriority > 0 && (
                      <Badge variant="outline" title="Kitchen Priority">
                        P{dish.orderPriority}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(dish)}>
                    Edit
                  </Button>
                  <Button
                    variant={dish.isAvailable ? "destructive" : "default"}
                    size="sm"
                    onClick={() => handleToggleAvailability(dish.id, dish.isAvailable)}
                    disabled={toggleAvailability.isPending}
                  >
                    {dish.isAvailable ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{dish.description}</p>
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">${(dish.price / 100).toFixed(2)}</span>
                <span
                  className={`text-sm px-2 py-1 rounded ${
                    dish.isAvailable
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                  }`}
                >
                  {dish.isAvailable ? "Available" : "Disabled"}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}

          {dishes.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground mb-4">No dishes found</p>
                <Button onClick={handleCreateNew}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Dish
                </Button>
              </CardContent>
            </Card>
          )}
          </div>
        </TabsContent>

        <TabsContent value="categories">
          <CategoryManager />
        </TabsContent>

        <TabsContent value="modifiers">
          <div className="grid gap-6">
            <ModifierManager />
            <ModifierGroupEditor />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
