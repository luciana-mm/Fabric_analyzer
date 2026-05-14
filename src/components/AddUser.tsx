import { X } from "lucide-react"

export default function AddUser({
    isOpen,
    isClosed
}){
    if(!isOpen) return null

    return(
        <div className="w-full h-full inset-0 fixed z-50 flex items-center justify-center bg-black/60 text-sm">
            <div className="w-[500px] bg-[#0a0c14] p-6">
                <div className="flex justify-between">
                    <h1 className="mb-5 text-lg">
                        Adicionar funcionário
                    </h1>
                    <X
                        onClick={isClosed}
                        className="cursor-pointer text-white/50"
                    />
                </div>
                <div className="flex flex-col gap-3">
                    <label>Nome</label>
                    <input 
                        placeholder="Ex: João Silva"
                        type="text"
                        className="bg-[#1318299c] p-3 rounded-[10px]" />
                    <label>Codigo</label>
                    <input 
                        placeholder="Ex: 33333"
                        type="text" 
                        className="bg-[#1318299c] p-3 rounded-[10px] "/>
                    <label>Email</label>
                    <input 
                        placeholder="Ex: usuario@usuario.com"
                        type="text" 
                        className="bg-[#1318299c] p-3 rounded-[10px] "/>
                    <label>Senha</label>
                    <input 
                        placeholder="xxxxxx"
                        type="password" 
                        className="bg-[#1318299c] p-3 rounded-[10px] "/>
                    <label>Confirmar senha</label>
                    <input 
                        placeholder="xxxxxx"
                        type="password" 
                        className="bg-[#1318299c] p-3 rounded-[10px] "/>
                </div>
                <div className="flex justify-end mt-5">
                    <button className="p-3 flex-col justify-items-center bg-gray-700 w-[100px] gap-2 rounded-[10px] hover:bg-gray-600">
                        Salvar
                    </button>
                </div>
            </div>
        </div>
    )
}