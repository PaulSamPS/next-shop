import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ShoppingCart } from './shopping-cart.model';
import { UserService } from '@/modules/user';
import { ProductService } from '@/modules/product';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { Product } from '@/modules/product/product.model';
import { ProductCartDto } from '@/modules/shopping-cart/dto/productCart.dto';
import { AppMessage } from '@/common/constants/appMessage';
import { AppError } from '@/common/constants/appError';

@Injectable()
export class ShoppingCartService {
  constructor(
    @InjectModel(ShoppingCart)
    private shoppingCartModel: typeof ShoppingCart,
    private readonly usersService: UserService,
    private readonly productsService: ProductService,
  ) {}

  async findAll(userId: number): Promise<ShoppingCart[]> {
    return this.shoppingCartModel.findAll({ where: { userId } });
  }

  async get(userId: number) {
    const shoppingCart = new ShoppingCart();
    const exitingShoppingCart = await this.shoppingCartModel.findOne({
      where: { user: userId },
    });

    if (!exitingShoppingCart) {
      return shoppingCart.save();
    }

    return exitingShoppingCart;
  }

  async add(
    addToCartDto: AddToCartDto,
    userId: number,
  ): Promise<ShoppingCart | { message: string }> {
    const product: Product = await this.productsService.findOneByiD(
      addToCartDto.productId,
    );

    const exitingShoppingCart = await this.shoppingCartModel.findOne({
      where: { user: userId },
    });

    if (!product) {
      throw new HttpException(
        AppError.ITEM_DOES_NOT_EXIST,
        HttpStatus.BAD_REQUEST,
      );
    }

    console.log(product.images);

    if (!exitingShoppingCart) {
      const newCart: {
        user: number;
        products: ProductCartDto[];
        total_price: number;
      } = {
        user: userId,
        products: [
          {
            productId: product.id,
            name: product.name,
            price: product.price,
            weight: product.weight,
            in_stock: product.in_stock - 1,
            image: product.images[0].url,
            count: 1,
          },
        ],
        total_price: product.price,
      };

      return await this.shoppingCartModel.create(newCart);
    }

    const productIncludes: boolean = exitingShoppingCart.products.some(
      (p: ProductCartDto) => p.productId === product.id,
    );

    if (productIncludes) {
      return { message: AppMessage.ITEM_ALREADY_IN_THE_CART };
    }

    const newProduct: ProductCartDto = {
      productId: product.id,
      name: product.name,
      price: product.price,
      weight: product.weight,
      in_stock: product.in_stock - 1,
      image: product.images[0].url,
      count: 1,
    };

    exitingShoppingCart.products = [
      ...exitingShoppingCart.products,
      newProduct,
    ];
    exitingShoppingCart.total_price += product.price;

    await exitingShoppingCart.save();

    return exitingShoppingCart;
  }

  async increaseCountAndTotalPrice(addToCartDto: AddToCartDto, userId: number) {
    const product: Product = await this.productsService.findOneByiD(
      addToCartDto.productId,
    );

    const exitingShoppingCart = await this.shoppingCartModel.findOne({
      where: { user: userId },
    });

    const productIncludes: boolean = exitingShoppingCart.products.some(
      (p: ProductCartDto) => p.productId === product.id,
    );

    if (exitingShoppingCart && productIncludes) {
      const productInTheCart: ProductCartDto =
        exitingShoppingCart.products.find(
          (p: ProductCartDto) => p.productId === product.id,
        );

      if (productInTheCart.in_stock > 0) {
        productInTheCart.count += 1;

        productInTheCart.in_stock -= 1;

        exitingShoppingCart.total_price += product.price;

        exitingShoppingCart.changed('products', true);

        return await exitingShoppingCart.save();
      }

      return exitingShoppingCart;
    }
  }

  async decreaseCountAndTotalPrice(addToCartDto: AddToCartDto, userId: number) {
    const product: Product = await this.productsService.findOneByiD(
      addToCartDto.productId,
    );

    const exitingShoppingCart = await this.shoppingCartModel.findOne({
      where: { user: userId },
    });

    const productIncludes: boolean = exitingShoppingCart.products.some(
      (p: ProductCartDto) => p.productId === product.id,
    );

    if (exitingShoppingCart && productIncludes) {
      const productInTheCart: ProductCartDto =
        exitingShoppingCart.products.find(
          (p: ProductCartDto) => p.productId === product.id,
        );

      if (productInTheCart.in_stock < product.in_stock - 1) {
        productInTheCart.count -= 1;

        productInTheCart.in_stock += 1;

        exitingShoppingCart.total_price -= product.price;

        exitingShoppingCart.changed('products', true);

        return await exitingShoppingCart.save();
      }

      return exitingShoppingCart;
    }
  }

  async remove(productId: number, userId: number) {
    const product: Product = await this.productsService.findOneByiD(productId);

    const exitingShoppingCart = await this.shoppingCartModel.findOne({
      where: { user: userId },
    });

    const productIncludes = exitingShoppingCart.products.find(
      (p: ProductCartDto) => p.productId === product.id,
    );

    if (exitingShoppingCart && productIncludes) {
      const productInTheCart: ProductCartDto =
        exitingShoppingCart.products.filter(
          (p: ProductCartDto) => p.productId !== product.id,
        );

      exitingShoppingCart.total_price -= product.price * productIncludes.count;
      exitingShoppingCart.products = productInTheCart;

      return await exitingShoppingCart.save();
    }
  }

  async removeAll(userId: number): Promise<ShoppingCart> {
    const exitingShoppingCart = await this.shoppingCartModel.findOne({
      where: { user: userId },
    });

    exitingShoppingCart.products = [];
    exitingShoppingCart.total_price = 0;

    return await exitingShoppingCart.save();
  }
}
